import { createHash } from 'node:crypto';
import { readDirFiles } from './fs-utils.js';

const sha256 = (data: Uint8Array | string): string =>
  createHash('sha256').update(data).digest('hex');

/**
 * 技能内容树哈希（指纹）：对全部文件按路径排序拼接 `path\n sha256(content)\n` 后整体 sha256。
 * 与传输方式（tarball/zip/目录）无关，等价 git tree 语义。
 */
export function treeHashFromFiles(files: Record<string, Uint8Array>): string {
  const lines = Object.keys(files)
    .sort()
    .map((path) => `${path}\n${sha256(files[path]!)}\n`);
  return sha256(lines.join(''));
}

export function treeHashFromDir(dir: string): string | null {
  const files = readDirFiles(dir);
  if (Object.keys(files).length === 0) return null;
  return treeHashFromFiles(files);
}
