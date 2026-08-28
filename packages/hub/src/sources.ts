import { gunzipSync } from 'fflate';
import {
  extractSkillMeta,
  isUnsafePath,
  parseFrontmatter,
  readZipEntries,
  validateSkillZip,
  type SkillMeta,
} from '@ripple/skill-core';
import { parseTar } from './tar.js';
import { treeHashFromFiles } from './fingerprint.js';
import type { SourceRepo } from './types.js';

export interface SkillPayload {
  meta: SkillMeta;
  /** 相对技能根的文件内容 */
  files: Record<string, Uint8Array>;
}

/** 从 ZIP 数据得到技能载荷（校验 + 以 SKILL.md 所在目录为根） */
export function payloadFromZip(data: Uint8Array): SkillPayload {
  const result = validateSkillZip(data, { maxSize: 100 * 1024 * 1024 });
  if (!result.ok || !result.meta || !result.entries) {
    throw new Error(result.error ?? 'Invalid skill package');
  }
  const prefix = result.skillRoot ? `${result.skillRoot}/` : '';
  const files: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(result.entries)) {
    if (!path.startsWith(prefix)) continue;
    const rel = path.slice(prefix.length);
    if (rel) files[rel] = content;
  }
  return { meta: result.meta, files };
}

export interface RepoSkill {
  name: string;
  description: string;
  version: string;
  /** tarball 内技能根目录 */
  root: string;
  /** 内容树哈希指纹（相对技能根） */
  fingerprint: string;
  /** 仓库内相对路径（去掉 tarball 首段），用于 commits API path 过滤 */
  repoPath: string;
}

export function parseRepoSpec(
  spec: string,
): Pick<SourceRepo, 'owner' | 'repo' | 'branch' | 'subdir' | 'provider' | 'host'> {
  const trimmed = spec.trim();
  // 完整 URL 形式（私服 GitLab public 仓库）：https://host/owner/repo[#branch][:subdir]
  const urlMatch = /^https?:\/\/([^/]+)\/([^/#:]+)\/([^/#:]+?)(?:\.git)?(?:#([^:]+))?(?::(.+))?$/.exec(
    trimmed,
  );
  if (urlMatch) {
    const host = urlMatch[1]!;
    const isGithub = host === 'github.com' || host === 'www.github.com';
    return {
      // github.com 不保留 host（label/id 与简写形式一致，避免被误判 GitLab）
      ...(isGithub ? {} : { host }),
      provider: isGithub ? 'github' : 'gitlab',
      owner: urlMatch[2]!,
      repo: urlMatch[3]!,
      branch: urlMatch[4] ?? 'main',
      subdir: urlMatch[5] ?? '',
    };
  }
  // 简写形式（GitHub）：owner/repo[#branch][:subdir]
  const match = /^([^/#:]+)\/([^/#:]+)(?:#([^:]+))?(?::(.+))?$/.exec(trimmed);
  if (!match) {
    throw new Error(
      `Invalid repo spec: ${spec}（期望 owner/repo[#branch][:subdir] 或 https://host/owner/repo[#branch][:subdir]）`,
    );
  }
  return {
    provider: 'github',
    owner: match[1]!,
    repo: match[2]!,
    branch: match[3] ?? 'main',
    subdir: match[4] ?? '',
  };
}

export function tarballUrl(
  repo: Pick<SourceRepo, 'owner' | 'repo' | 'branch' | 'provider' | 'host'>,
): string {
  if (repo.provider === 'gitlab' && repo.host) {
    // GitLab（含私服，public 仓库无需鉴权）
    return `https://${repo.host}/${repo.owner}/${repo.repo}/-/archive/${repo.branch}/${repo.repo}-${repo.branch}.tar.gz`;
  }
  return `https://codeload.github.com/${repo.owner}/${repo.repo}/tar.gz/${repo.branch}`;
}

export async function fetchRepoTarball(
  repo: Pick<SourceRepo, 'owner' | 'repo' | 'branch' | 'provider' | 'host'>,
  fetchImpl: typeof fetch = fetch,
): Promise<Uint8Array> {
  const url = tarballUrl(repo);
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Fetch ${repo.owner}/${repo.repo} failed: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** 扫描 tarball 中所有含 SKILL.md 的目录（可限定子目录） */
export function scanTarballSkills(tarGz: Uint8Array, subdir = ''): { skills: RepoSkill[]; entries: ReturnType<typeof parseTar> } {
  const entries = parseTar(gunzipSync(tarGz)).filter((e) => !isUnsafePath(e.path));
  const skills: RepoSkill[] = [];
  const decoder = new TextDecoder();
  for (const entry of entries) {
    if (!entry.path.endsWith('/SKILL.md')) continue;
    // tarball 首段是 "<repo>-<branch>/"
    const inner = entry.path.split('/').slice(1).join('/');
    const root = entry.path.slice(0, -'/SKILL.md'.length);
    if (subdir) {
      const innerDir = inner.slice(0, -'/SKILL.md'.length);
      if (!(innerDir === subdir || innerDir.startsWith(`${subdir}/`))) continue;
    }
    const metaResult = extractSkillMeta(parseFrontmatter(decoder.decode(entry.data)));
    if (!metaResult.ok) continue;
    const prefix = `${root}/`;
    const skillFiles: Record<string, Uint8Array> = {};
    for (const e of entries) {
      if (e.path.startsWith(prefix)) {
        const rel = e.path.slice(prefix.length);
        if (rel) skillFiles[rel] = e.data;
      }
    }
    skills.push({
      name: metaResult.meta.name,
      description: metaResult.meta.description,
      version: metaResult.meta.version,
      root,
      fingerprint: treeHashFromFiles(skillFiles),
      repoPath: root.split('/').slice(1).join('/'),
    });
  }
  return { skills, entries };
}

export function payloadFromTarball(
  tarGz: Uint8Array,
  skillName: string,
  subdir = '',
): SkillPayload {
  const { skills, entries } = scanTarballSkills(tarGz, subdir);
  const found = skills.find((s) => s.name === skillName);
  if (!found) throw new Error(`Skill '${skillName}' not found in repository`);
  const files: Record<string, Uint8Array> = {};
  const prefix = `${found.root}/`;
  const decoder = new TextDecoder();
  for (const entry of entries) {
    if (!entry.path.startsWith(prefix)) continue;
    const rel = entry.path.slice(prefix.length);
    if (rel) files[rel] = entry.data;
  }
  const skillMd = files['SKILL.md'];
  const metaResult = extractSkillMeta(parseFrontmatter(decoder.decode(skillMd!)));
  if (!metaResult.ok) throw new Error(metaResult.error);
  return { meta: metaResult.meta, files };
}

export { readZipEntries };
