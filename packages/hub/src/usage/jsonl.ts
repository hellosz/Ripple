import { createReadStream, existsSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import type { JsonlCursor } from './types.js';

export interface JsonlScanResult {
  /** 游标之后新增的完整行 */
  lines: string[];
  cursor: JsonlCursor;
  /** 本次是否因截断/替换从头重扫 */
  rescanned: boolean;
}

/**
 * 从游标字节偏移流式续读 jsonl 新增行（禁止整读大文件）。
 * size 变小视为截断/替换 → 从头重扫（事件 id 幂等保证不重复计数）。
 */
export async function readJsonlIncrement(file: string, prev?: JsonlCursor): Promise<JsonlScanResult> {
  if (!existsSync(file)) {
    return { lines: [], cursor: prev ?? { offset: 0, size: 0, mtime: 0 }, rescanned: false };
  }
  const stat = statSync(file);
  const size = stat.size;
  const rescanned = prev !== undefined && size < prev.size;
  const start = prev && !rescanned ? prev.offset : 0;
  const cursor: JsonlCursor = { offset: size, size, mtime: stat.mtimeMs };
  if (size <= start) return { lines: [], cursor, rescanned };
  const lines: string[] = [];
  const stream = createReadStream(file, { start, end: size - 1, encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) lines.push(line);
  }
  return { lines, cursor, rescanned };
}
