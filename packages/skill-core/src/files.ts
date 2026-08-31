import { createHash } from 'node:crypto';
import type { ZipEntries } from './zip.js';

export const BINARY_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.zip',
  '.pdf',
  '.bin',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.avif',
  '.webp',
]);

export const LANG_MAP: Record<string, string> = {
  '.py': 'python',
  '.js': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
  '.md': 'markdown',
  '.sh': 'bash',
  '.bash': 'bash',
  '.css': 'css',
  '.html': 'html',
  '.sql': 'sql',
  '.toml': 'toml',
  '.xml': 'xml',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.rb': 'ruby',
};

export interface TextFileRecord {
  path: string;
  content: string;
  language: string | null;
  size: number;
  sha256: string;
}

function extOf(name: string): string {
  const base = name.split('/').pop() ?? name;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot).toLowerCase() : '';
}

/** 与旧实现一致：跳过隐藏文件/目录与二进制扩展名，仅收录合法 UTF-8 文本 */
export function extractTextFiles(entries: ZipEntries, skillRoot: string): TextFileRecord[] {
  const prefix = skillRoot ? `${skillRoot}/` : '';
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const records: TextFileRecord[] = [];
  for (const [name, data] of Object.entries(entries)) {
    if (!name.startsWith(prefix)) continue;
    const relPath = name.slice(prefix.length);
    if (!relPath) continue;
    const segments = relPath.split('/');
    if (segments.some((s) => s.startsWith('.'))) continue;
    const ext = extOf(relPath);
    if (BINARY_EXTS.has(ext)) continue;
    let content: string;
    try {
      content = decoder.decode(data);
    } catch {
      continue;
    }
    records.push({
      path: relPath,
      content,
      language: LANG_MAP[ext] ?? null,
      size: data.byteLength,
      sha256: createHash('sha256').update(data).digest('hex'),
    });
  }
  return records.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: TreeNode[];
}

/** 从扁平路径重建目录树（目录在前，字典序） */
export function buildFileTree(records: Array<{ path: string; size: number }>): TreeNode[] {
  interface DirMap {
    [key: string]: DirMap | number;
  }
  const root: DirMap = {};
  for (const record of records) {
    const parts = record.path.split('/');
    let node: DirMap = root;
    for (const part of parts.slice(0, -1)) {
      const next = node[part];
      if (typeof next === 'object') {
        node = next;
      } else {
        const created: DirMap = {};
        node[part] = created;
        node = created;
      }
    }
    node[parts[parts.length - 1] as string] = record.size;
  }
  const convert = (node: DirMap, prefix: string): TreeNode[] => {
    const dirs: TreeNode[] = [];
    const files: TreeNode[] = [];
    for (const name of Object.keys(node).sort()) {
      const value = node[name] as DirMap | number;
      const path = prefix ? `${prefix}/${name}` : name;
      if (typeof value === 'number') {
        files.push({ name, path, type: 'file', size: value });
      } else {
        dirs.push({ name, path, type: 'directory', children: convert(value, path) });
      }
    }
    return [...dirs, ...files];
  };
  return convert(root, '');
}
