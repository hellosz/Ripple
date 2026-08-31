import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter, rateSkill } from '@ripple/skill-core';
import type { Rating } from '@ripple/contract';
import { fetchRepoTarball, scanTarballSkills, type RepoSkill } from '../sources.js';

/** 发现索引中的仓库条目（质量信号随行） */
export interface DiscoverRepo {
  owner: string;
  repo: string;
  branch?: string;
  stars: number;
  /** 最近推送时间（ISO）；预算内未富化的 curated 条目为 null */
  pushed_at: string | null;
  license: string | null;
  topics: string[];
  origin: 'curated' | 'topic-search' | 'code-search';
  note?: string;
}

export interface DiscoverIndex {
  fetched_at: string;
  /** 实时获取失败/限流时为 true（返回缓存或种子） */
  degraded: boolean;
  repos: DiscoverRepo[];
}

export interface DiscoverSkill extends RepoSkill {
  /** 本地 rateSkill 评级（无 AI 调用） */
  local_grade: Rating;
}

export interface DiscoverRepoSkills {
  /** 缓存失效键：branch@pushed_at */
  key: string;
  scanned_at: string;
  skills: DiscoverSkill[];
}

/** 内置 curated 种子：官方仓库 + 精选 awesome 列表（列表本身也是仓库条目，其 README 另行解析扩充） */
const CURATED_SEEDS: DiscoverRepo[] = [
  {
    owner: 'anthropics',
    repo: 'skills',
    branch: 'main',
    stars: 0,
    pushed_at: null,
    license: null,
    topics: [],
    origin: 'curated',
    note: '官方技能仓库',
  },
];

/** awesome 列表（README 解析出更多 curated 仓库；解析失败静默降级） */
const AWESOME_LISTS: Array<{ owner: string; repo: string }> = [
  { owner: 'ComposioHQ', repo: 'awesome-claude-skills' },
  { owner: 'travisvn', repo: 'awesome-claude-skills' },
];

/** 单次刷新 API 请求预算（免鉴权 10 次/分钟、60 次/小时的余量控制） */
const REFRESH_BUDGET = 8;
const INDEX_TTL_MS = 24 * 60 * 60 * 1000;

interface GithubRepoItem {
  name?: string;
  owner?: { login?: string };
  stargazers_count?: number;
  pushed_at?: string;
  default_branch?: string;
  license?: { spdx_id?: string | null; name?: string | null } | null;
  topics?: string[];
}

function repoKey(owner: string, repo: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

function fromGithubItem(item: GithubRepoItem, origin: DiscoverRepo['origin']): DiscoverRepo | null {
  const owner = item.owner?.login;
  const repo = item.name;
  if (!owner || !repo) return null;
  return {
    owner,
    repo,
    branch: item.default_branch ?? 'main',
    stars: item.stargazers_count ?? 0,
    pushed_at: item.pushed_at ?? null,
    license: item.license?.spdx_id ?? item.license?.name ?? null,
    topics: item.topics ?? [],
    origin,
  };
}

/** 从 awesome README markdown 中抽取 github.com/owner/repo 链接（排除 anchors/issues/子路径歧义） */
export function parseAwesomeRepos(markdown: string): Array<{ owner: string; repo: string }> {
  const seen = new Set<string>();
  const result: Array<{ owner: string; repo: string }> = [];
  const re = /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?=[)\s"'#/]|$)/g;
  for (const match of markdown.matchAll(re)) {
    const owner = match[1]!;
    const repo = match[2]!;
    // 排除非仓库路径（orgs/topics 等保留字）与 issues/pull 尾随由正则边界保证
    if (['topics', 'orgs', 'search', 'sponsors', 'features', 'marketplace'].includes(owner)) continue;
    const key = repoKey(owner, repo);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ owner, repo });
  }
  return result;
}

export class SkillDiscovery {
  private baseDir: string;
  private fetchImpl: typeof fetch;
  private now: () => Date;
  private sleepImpl: (ms: number) => Promise<void>;

  constructor(opts: {
    baseDir: string;
    fetchImpl?: typeof fetch;
    now?: () => Date;
    sleepImpl?: (ms: number) => Promise<void>;
  }) {
    this.baseDir = opts.baseDir;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? (() => new Date());
    this.sleepImpl = opts.sleepImpl ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  private indexFile(): string {
    return join(this.baseDir, 'index.json');
  }

  private readIndexCache(): DiscoverIndex | null {
    try {
      return JSON.parse(readFileSync(this.indexFile(), 'utf8')) as DiscoverIndex;
    } catch {
      return null;
    }
  }

  private writeCache(file: string, data: unknown): void {
    mkdirSync(this.baseDir, { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  }

  /** 发现索引：TTL 24h；refresh 强制刷新；降级链 实时→缓存→种子 */
  async getIndex(refresh = false): Promise<DiscoverIndex> {
    const cached = this.readIndexCache();
    if (!refresh && cached) {
      const age = this.now().getTime() - new Date(cached.fetched_at).getTime();
      if (age >= 0 && age < INDEX_TTL_MS) return cached;
    }
    try {
      const repos = await this.fetchLive();
      const index: DiscoverIndex = {
        fetched_at: this.now().toISOString(),
        degraded: false,
        repos,
      };
      this.writeCache(this.indexFile(), index);
      return index;
    } catch {
      if (cached) return { ...cached, degraded: true };
      return { fetched_at: this.now().toISOString(), degraded: true, repos: [...CURATED_SEEDS] };
    }
  }

  /** 预算内实时获取：topic search + awesome 解析 + 少量 curated 富化；限流/失败抛错交给降级链 */
  private async fetchLive(): Promise<DiscoverRepo[]> {
    let budget = REFRESH_BUDGET;
    const request = async (url: string): Promise<Response> => {
      if (budget <= 0) throw new Error('刷新请求预算耗尽');
      budget--;
      const response = await this.fetchImpl(url, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (response.status === 403 || response.status === 429) {
        throw new Error(`GitHub API 限流（HTTP ${response.status}）`);
      }
      return response;
    };

    // 1. topic 搜索（核心来源；失败即整体降级）
    const searchResponse = await request(
      'https://api.github.com/search/repositories?q=topic:agent-skills&sort=stars&order=desc&per_page=50',
    );
    if (!searchResponse.ok) throw new Error(`topic 搜索失败: HTTP ${searchResponse.status}`);
    const searchData = (await searchResponse.json()) as { items?: GithubRepoItem[] };
    const byKey = new Map<string, DiscoverRepo>();
    for (const item of searchData.items ?? []) {
      const entry = fromGithubItem(item, 'topic-search');
      if (entry) byKey.set(repoKey(entry.owner, entry.repo), entry);
    }

    // 2. curated：种子 + awesome README 解析（README 走 raw，不计 API 配额，但仍占预算控制总量）
    const curated: Array<{ owner: string; repo: string; note?: string }> = CURATED_SEEDS.map(
      (s) => ({ owner: s.owner, repo: s.repo, note: s.note }),
    );
    for (const list of AWESOME_LISTS) {
      try {
        const response = await this.fetchImpl(
          `https://raw.githubusercontent.com/${list.owner}/${list.repo}/HEAD/README.md`,
        );
        if (!response.ok) continue;
        for (const found of parseAwesomeRepos(await response.text())) {
          if (repoKey(found.owner, found.repo) === repoKey(list.owner, list.repo)) continue;
          curated.push(found);
        }
      } catch {
        /* awesome 解析失败静默降级 */
      }
    }

    // 3. 合并：topic 命中的 curated 条目沿用质量数据但 origin 标 curated；未命中的在预算内富化
    const result: DiscoverRepo[] = [];
    const curatedSeen = new Set<string>();
    for (const c of curated) {
      const key = repoKey(c.owner, c.repo);
      if (curatedSeen.has(key)) continue;
      curatedSeen.add(key);
      const hit = byKey.get(key);
      if (hit) {
        result.push({ ...hit, origin: 'curated', ...(c.note ? { note: c.note } : {}) });
        byKey.delete(key);
        continue;
      }
      let enriched: DiscoverRepo | null = null;
      if (budget > 0) {
        try {
          const response = await request(`https://api.github.com/repos/${c.owner}/${c.repo}`);
          if (response.ok) {
            enriched = fromGithubItem((await response.json()) as GithubRepoItem, 'curated');
          }
        } catch (error) {
          // 限流向上抛触发降级；其余（单仓库 404 等）跳过富化
          if (error instanceof Error && error.message.includes('限流')) throw error;
        }
      }
      result.push(
        enriched
          ? { ...enriched, ...(c.note ? { note: c.note } : {}) }
          : {
              owner: c.owner,
              repo: c.repo,
              stars: 0,
              pushed_at: null,
              license: null,
              topics: [],
              origin: 'curated',
              ...(c.note ? { note: c.note } : {}),
            },
      );
    }
    result.push(...byKey.values());
    result.sort((a, b) => b.stars - a.stars);
    return result;
  }

  /** 仓库技能懒扫描：codeload tarball（不计 API 配额）+ 本地评级；branch+pushed_at 为缓存失效键 */
  async getRepoSkills(repo: {
    owner: string;
    repo: string;
    branch?: string;
    pushed_at?: string | null;
  }): Promise<DiscoverRepoSkills> {
    const branch = repo.branch ?? 'main';
    const key = `${branch}@${repo.pushed_at ?? ''}`;
    const cacheFile = join(this.baseDir, `${repo.owner}__${repo.repo}.json`);
    if (existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(readFileSync(cacheFile, 'utf8')) as DiscoverRepoSkills;
        if (cached.key === key) return cached;
      } catch {
        /* 缓存损坏则重扫 */
      }
    }
    const tarGz = await fetchRepoTarball(
      { owner: repo.owner, repo: repo.repo, branch, provider: 'github' },
      this.fetchImpl,
    );
    const { skills, entries } = scanTarballSkills(tarGz);
    const decoder = new TextDecoder();
    const rated: DiscoverSkill[] = skills.map((skill) => {
      const md = entries.find((e) => e.path === `${skill.root}/SKILL.md`);
      const content = md ? decoder.decode(md.data) : '';
      const hasAgentsDir = entries.some((e) => e.path.startsWith(`${skill.root}/agents/`));
      const { rating } = rateSkill(content, parseFrontmatter(content) ?? {}, hasAgentsDir);
      return { ...skill, local_grade: rating };
    });
    const result: DiscoverRepoSkills = {
      key,
      scanned_at: this.now().toISOString(),
      skills: rated,
    };
    this.writeCache(cacheFile, result);
    return result;
  }

  /** PAT 深度探索：code search filename:SKILL.md（限流退避一次）；PAT 只经内存，不落盘不打日志 */
  async deepSearch(pat: string, query = ''): Promise<DiscoverRepo[]> {
    if (!pat) throw new Error('需配置 GitHub PAT 才能使用深度探索');
    const q = encodeURIComponent(`filename:SKILL.md${query ? ` ${query}` : ''}`);
    const url = `https://api.github.com/search/code?q=${q}&per_page=50`;
    const doFetch = (): Promise<Response> =>
      this.fetchImpl(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${pat}`,
        },
      });
    let response = await doFetch();
    if (response.status === 403 || response.status === 429) {
      // code search 10 次/分钟：退避后重试一次
      await this.sleepImpl(6000);
      response = await doFetch();
    }
    if (!response.ok) throw new Error(`深度探索失败: HTTP ${response.status}`);
    const data = (await response.json()) as {
      items?: Array<{ repository?: GithubRepoItem & { full_name?: string } }>;
    };
    const seen = new Set<string>();
    const result: DiscoverRepo[] = [];
    for (const item of data.items ?? []) {
      const repository = item.repository;
      const owner = repository?.owner?.login;
      const repo = repository?.name;
      if (!owner || !repo) continue;
      const key = repoKey(owner, repo);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        owner,
        repo,
        stars: repository?.stargazers_count ?? 0,
        pushed_at: repository?.pushed_at ?? null,
        license: repository?.license?.spdx_id ?? null,
        topics: repository?.topics ?? [],
        origin: 'code-search',
      });
    }
    return result;
  }
}
