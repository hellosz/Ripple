import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync, strToU8 } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { SkillDiscovery, parseAwesomeRepos, type DiscoverIndex } from './discover.js';

const encoder = new TextEncoder();

/** 极简 tar 构造器（与 parseTar 对应；从 hub.test.ts 同款工具复制） */
function buildTar(files: Record<string, Uint8Array>): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const [path, data] of Object.entries(files)) {
    const header = new Uint8Array(512);
    header.set(encoder.encode(path.slice(0, 100)), 0);
    header.set(encoder.encode('0000644\0'), 100);
    header.set(encoder.encode('0000000\0'), 108);
    header.set(encoder.encode('0000000\0'), 116);
    header.set(encoder.encode(data.length.toString(8).padStart(11, '0') + '\0'), 124);
    header.set(encoder.encode('00000000000\0'), 136);
    header.set(encoder.encode('        '), 148);
    header[156] = 48;
    blocks.push(header);
    blocks.push(data);
    const pad = (512 - (data.length % 512)) % 512;
    if (pad) blocks.push(new Uint8Array(pad));
  }
  blocks.push(new Uint8Array(1024));
  const total = blocks.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of blocks) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function topicItem(owner: string, repo: string, stars: number, pushedDaysAgo: number) {
  return {
    name: repo,
    owner: { login: owner },
    stargazers_count: stars,
    pushed_at: new Date(Date.now() - pushedDaysAgo * 86400_000).toISOString(),
    default_branch: 'main',
    license: { spdx_id: 'MIT' },
    topics: ['agent-skills'],
  };
}

let baseDir: string;

beforeEach(() => {
  baseDir = mkdtempSync(join(tmpdir(), 'ripple-discover-'));
});

describe('parseAwesomeRepos', () => {
  it('抽取 github 仓库链接并去重、排除保留字路径', () => {
    const md = [
      '- [A](https://github.com/acme/skills) 好用',
      '- [A again](https://github.com/acme/skills#readme)',
      '- [B](https://github.com/foo/bar.git)',
      '- [Topic](https://github.com/topics/agent-skills)',
      '普通文字 github.com/baz/qux 也算',
    ].join('\n');
    expect(parseAwesomeRepos(md)).toEqual([
      { owner: 'acme', repo: 'skills' },
      { owner: 'foo', repo: 'bar' },
      { owner: 'baz', repo: 'qux' },
    ]);
  });
});

describe('发现索引：获取 / 缓存 / 降级链', () => {
  it('正常获取：topic 命中官方种子标 curated，含质量信号，按 stars 排序，写缓存', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      const u = String(url);
      calls.push(u);
      if (u.includes('search/repositories')) {
        return jsonResponse({
          items: [
            topicItem('anthropics', 'skills', 5000, 3),
            topicItem('acme', 'packs', 2400, 30),
          ],
        });
      }
      if (u.includes('raw.githubusercontent.com')) {
        return new Response('- [x](https://github.com/curated-only/thing)', { status: 200 });
      }
      // curated 富化请求
      return jsonResponse(topicItem('curated-only', 'thing', 7, 400));
    }) as unknown as typeof fetch;

    const discovery = new SkillDiscovery({ baseDir, fetchImpl });
    const index = await discovery.getIndex(true);
    expect(index.degraded).toBe(false);
    const official = index.repos.find((r) => r.owner === 'anthropics')!;
    expect(official.origin).toBe('curated');
    expect(official.stars).toBe(5000);
    expect(official.note).toBe('官方技能仓库');
    expect(official.license).toBe('MIT');
    const acme = index.repos.find((r) => r.owner === 'acme')!;
    expect(acme.origin).toBe('topic-search');
    expect(acme.stars).toBe(2400);
    // stars 排序：5000 > 2400 > 7
    expect(index.repos.map((r) => r.stars)).toEqual([...index.repos.map((r) => r.stars)].sort((a, b) => b - a));
    // 缓存已写
    const cached = JSON.parse(readFileSync(join(baseDir, 'index.json'), 'utf8')) as DiscoverIndex;
    expect(cached.repos.length).toBe(index.repos.length);
    // 请求预算 ≤ 8（api 请求 + 2 个 raw README）
    expect(calls.length).toBeLessThanOrEqual(10);
  });

  it('TTL 内直接返回缓存不发请求；过期后重新获取', async () => {
    mkdirSync(baseDir, { recursive: true });
    const fresh: DiscoverIndex = {
      fetched_at: new Date().toISOString(),
      degraded: false,
      repos: [],
    };
    writeFileSync(join(baseDir, 'index.json'), JSON.stringify(fresh));
    let called = 0;
    const fetchImpl = (async () => {
      called++;
      return jsonResponse({ items: [] });
    }) as unknown as typeof fetch;
    const discovery = new SkillDiscovery({ baseDir, fetchImpl });
    await discovery.getIndex();
    expect(called).toBe(0);
    // 过期（25 小时后）
    const later = new SkillDiscovery({
      baseDir,
      fetchImpl,
      now: () => new Date(Date.now() + 25 * 3600_000),
    });
    await later.getIndex();
    expect(called).toBeGreaterThan(0);
  });

  it('403 限流且有缓存：返回缓存并标 degraded，不抛错', async () => {
    mkdirSync(baseDir, { recursive: true });
    const yesterday: DiscoverIndex = {
      fetched_at: new Date(Date.now() - 25 * 3600_000).toISOString(),
      degraded: false,
      repos: [
        { owner: 'x', repo: 'y', stars: 1, pushed_at: null, license: null, topics: [], origin: 'topic-search' },
      ],
    };
    writeFileSync(join(baseDir, 'index.json'), JSON.stringify(yesterday));
    const fetchImpl = (async () => new Response('rate limited', { status: 403 })) as unknown as typeof fetch;
    const discovery = new SkillDiscovery({ baseDir, fetchImpl });
    const index = await discovery.getIndex();
    expect(index.degraded).toBe(true);
    expect(index.repos).toHaveLength(1);
    expect(index.repos[0]!.owner).toBe('x');
  });

  it('限流且无缓存：回退内置种子（官方仓库在列）', async () => {
    const fetchImpl = (async () => new Response('', { status: 429 })) as unknown as typeof fetch;
    const discovery = new SkillDiscovery({ baseDir, fetchImpl });
    const index = await discovery.getIndex(true);
    expect(index.degraded).toBe(true);
    expect(index.repos.some((r) => r.owner === 'anthropics' && r.repo === 'skills')).toBe(true);
  });

  it('awesome 解析失败静默降级：索引仍成功且不含 awesome 衍生仓库', async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('search/repositories')) return jsonResponse({ items: [topicItem('a', 'b', 10, 5)] });
      if (u.includes('raw.githubusercontent.com')) throw new Error('network down');
      return jsonResponse(topicItem('anthropics', 'skills', 1, 1));
    }) as unknown as typeof fetch;
    const discovery = new SkillDiscovery({ baseDir, fetchImpl });
    const index = await discovery.getIndex(true);
    expect(index.degraded).toBe(false);
    expect(index.repos.some((r) => r.owner === 'a')).toBe(true);
  });
});

describe('仓库懒扫描与本地评级', () => {
  const skillMd = `---\nname: demo-skill\ndescription: ${'用于发现层单元测试的技能描述内容，这一段描述文字的长度需要超过五十个字符，才能满足 S 级评级对描述完整性的要求。'}\n---\n\n## Workflow\n\n步骤\n\n## Decision Rules\n\n规则\n\n## Quality\n\n\`\`\`bash\necho ok\n\`\`\`\n`;

  function tarballOf(files: Record<string, string>): Uint8Array {
    const entries: Record<string, Uint8Array> = {};
    for (const [path, content] of Object.entries(files)) entries[path] = strToU8(content);
    return gzipSync(buildTar(entries));
  }

  it('首次拉取 tarball 扫描并评级、写缓存；键一致时命中缓存不再拉取', async () => {
    let fetches = 0;
    const tarGz = tarballOf({
      'repo-main/demo-skill/SKILL.md': skillMd,
      'repo-main/demo-skill/agents/reviewer.md': '# a',
    });
    const fetchImpl = (async () => {
      fetches++;
      return new Response(tarGz.slice().buffer, { status: 200 });
    }) as unknown as typeof fetch;
    const discovery = new SkillDiscovery({ baseDir, fetchImpl });
    const repo = { owner: 'acme', repo: 'skills', branch: 'main', pushed_at: '2026-08-01T00:00:00Z' };
    const first = await discovery.getRepoSkills(repo);
    expect(first.skills).toHaveLength(1);
    expect(first.skills[0]!.name).toBe('demo-skill');
    expect(first.skills[0]!.local_grade).toBe('S');
    expect(fetches).toBe(1);
    const again = await discovery.getRepoSkills(repo);
    expect(again.skills).toHaveLength(1);
    expect(fetches).toBe(1);
    // pushed_at 变化 → 缓存失效重扫
    await discovery.getRepoSkills({ ...repo, pushed_at: '2026-08-31T00:00:00Z' });
    expect(fetches).toBe(2);
  });

  it('tarball 拉取失败抛明确错误', async () => {
    const fetchImpl = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    const discovery = new SkillDiscovery({ baseDir, fetchImpl });
    await expect(
      discovery.getRepoSkills({ owner: 'no', repo: 'pe' }),
    ).rejects.toThrow(/HTTP 404/);
  });
});

describe('PAT 深度探索', () => {
  it('未配置 PAT 抛错', async () => {
    const discovery = new SkillDiscovery({ baseDir });
    await expect(discovery.deepSearch('')).rejects.toThrow(/PAT/);
  });

  it('带 Bearer 头搜索并按仓库去重；限流退避一次后成功', async () => {
    let calls = 0;
    let slept = 0;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls++;
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      expect(auth).toBe('Bearer ghp_test');
      if (calls === 1) return new Response('', { status: 403 });
      return jsonResponse({
        items: [
          { repository: { name: 'skills', owner: { login: 'acme' }, stargazers_count: 9 } },
          { repository: { name: 'skills', owner: { login: 'acme' } } },
          { repository: { name: 'other', owner: { login: 'foo' } } },
        ],
      });
    }) as unknown as typeof fetch;
    const discovery = new SkillDiscovery({
      baseDir,
      fetchImpl,
      sleepImpl: async () => {
        slept++;
      },
    });
    const repos = await discovery.deepSearch('ghp_test', 'pdf');
    expect(slept).toBe(1);
    expect(calls).toBe(2);
    expect(repos).toHaveLength(2);
    expect(repos[0]).toMatchObject({ owner: 'acme', repo: 'skills', stars: 9, origin: 'code-search' });
  });
});
