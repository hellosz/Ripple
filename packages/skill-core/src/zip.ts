import { unzipSync, zipSync, type Zippable } from 'fflate';
import { extractSkillMeta, parseFrontmatter, type SkillMeta } from './frontmatter.js';

/** 服务端上传大小上限（10MB），与旧实现一致 */
export const MAX_SKILL_ZIP_SIZE = 10 * 1024 * 1024;

export type ZipEntries = Record<string, Uint8Array>;

export interface ZipValidation {
  ok: boolean;
  error?: string;
  meta?: SkillMeta;
  /** 路径 → 内容（不含目录条目），路径已经过穿越校验 */
  entries?: ZipEntries;
  /** 包内含 SKILL.md 的目录（作为技能根） */
  skillRoot?: string;
}

export function isUnsafePath(path: string): boolean {
  return path.startsWith('/') || path.split('/').includes('..') || path.includes('\\..');
}

/** 解包并做安全校验；任何不安全条目导致整体失败、不落任何文件 */
export function readZipEntries(data: Uint8Array): { entries?: ZipEntries; error?: string } {
  let raw: ZipEntries;
  try {
    raw = unzipSync(data);
  } catch {
    return { error: 'Not a valid ZIP file' };
  }
  const entries: ZipEntries = {};
  for (const [name, content] of Object.entries(raw)) {
    if (isUnsafePath(name)) return { error: `Unsafe path in ZIP: ${name}` };
    if (name.endsWith('/')) continue; // 目录条目
    entries[name] = content;
  }
  return { entries };
}

export function findSkillMdPath(entries: ZipEntries): string | null {
  for (const name of Object.keys(entries)) {
    const base = name.split('/').pop();
    if (base === 'SKILL.md') return name;
  }
  return null;
}

export function validateSkillZip(
  data: Uint8Array,
  opts: { maxSize?: number } = {},
): ZipValidation {
  const maxSize = opts.maxSize ?? MAX_SKILL_ZIP_SIZE;
  if (data.byteLength > maxSize) {
    return { ok: false, error: `ZIP exceeds size limit (${maxSize} bytes)` };
  }
  const { entries, error } = readZipEntries(data);
  if (!entries) return { ok: false, error };

  const skillMdPath = findSkillMdPath(entries);
  if (!skillMdPath) return { ok: false, error: 'ZIP must contain a SKILL.md file' };

  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(entries[skillMdPath]);
  } catch {
    return { ok: false, error: 'SKILL.md is not valid UTF-8' };
  }

  const metaResult = extractSkillMeta(parseFrontmatter(content));
  if (!metaResult.ok) return { ok: false, error: metaResult.error };

  const skillRoot = skillMdPath.includes('/')
    ? skillMdPath.slice(0, skillMdPath.lastIndexOf('/'))
    : '';
  return { ok: true, meta: metaResult.meta, entries, skillRoot };
}

/** 打包目录内容为 ZIP（纯 Node，无系统 zip 依赖） */
export function buildZip(files: Record<string, Uint8Array | string>): Uint8Array {
  const zippable: Zippable = {};
  const encoder = new TextEncoder();
  for (const [path, content] of Object.entries(files)) {
    zippable[path] = typeof content === 'string' ? encoder.encode(content) : content;
  }
  return zipSync(zippable);
}
