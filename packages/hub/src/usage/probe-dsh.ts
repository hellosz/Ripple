import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import * as zlib from 'node:zlib';
import { usageEventId } from './store.js';
import type { JsonlCursor, ProbeContext, ProbeScanResult, UsageEvent, UsageProbe } from './types.js';

const SKILL_PATH_RE = /skills\/([a-z0-9][a-z0-9-]*)\/SKILL\.md/g;
/** zstd frame magic（little-endian 0xFD2FB528） */
const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

type ZstdDecompress = (buf: Buffer) => Buffer;

function zstdDecompressSync(): ZstdDecompress | null {
  const fn = (zlib as unknown as { zstdDecompressSync?: ZstdDecompress }).zstdDecompressSync;
  return typeof fn === 'function' ? fn : null;
}

/**
 * 多帧 zstd 解压：DSH 会话按帧追加写，Node 的同步/流式 API 都只解首帧（实测），
 * 因此按 frame magic 分割逐帧解压；压缩数据内出现伪 magic 时该候选帧解压失败，
 * 向后合并下一段重试直至成功（或放弃该帧，不阻塞后续）。
 */
export function inflateZstdFrames(buf: Buffer, decompress: ZstdDecompress): string {
  const starts: number[] = [];
  let i = 0;
  while ((i = buf.indexOf(ZSTD_MAGIC, i)) !== -1) {
    starts.push(i);
    i += ZSTD_MAGIC.length;
  }
  const parts: Buffer[] = [];
  for (let k = 0; k < starts.length; k++) {
    for (let end = k + 1; end <= starts.length; end++) {
      const slice = buf.subarray(starts[k]!, end < starts.length ? starts[end] : undefined);
      try {
        parts.push(decompress(slice));
        k = end - 1;
        break;
      } catch {
        /* 伪 magic 截断：合并下一段重试 */
      }
    }
  }
  return Buffer.concat(parts).toString('utf8');
}

/** 从解压后的 DSH 会话文本提取使用事件（SKILL.md 路径启发式 + SSOT 白名单） */
export function eventsFromDshSession(
  text: string,
  file: string,
  known: ReadonlySet<string>,
): UsageEvent[] {
  const sessionId = basename(dirname(file));
  let projectDir = '';
  const events: UsageEvent[] = [];
  let fallbackTime = new Date(0).toISOString();
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    let time: string | null = null;
    try {
      const parsed = JSON.parse(raw) as { type?: string; cwd?: string; createdAt?: number; time?: number };
      if (parsed.type === 'session') {
        if (typeof parsed.cwd === 'string') projectDir = parsed.cwd;
        if (typeof parsed.createdAt === 'number') fallbackTime = new Date(parsed.createdAt).toISOString();
        continue;
      }
      if (typeof parsed.time === 'number') time = new Date(parsed.time).toISOString();
    } catch {
      /* 非 JSON 行也允许正则匹配 */
    }
    const skills = new Set<string>();
    for (const match of raw.matchAll(SKILL_PATH_RE)) {
      const name = match[1]!;
      if (known.has(name)) skills.add(name);
    }
    for (const skill of skills) {
      events.push({
        id: usageEventId('deepseek-harness', sessionId, `${raw}\n${skill}`),
        skill,
        agent: 'deepseek-harness',
        session_id: sessionId,
        project_dir: projectDir,
        occurred_at: time ?? fallbackTime,
        evidence: 'path-heuristic',
        source_file: file,
      });
    }
  }
  return events;
}

/**
 * DeepSeek Harness probe：~/.dsh/sessions/<proj>/session-<uuid>/session.jsonl.zstd。
 * 压缩文件无法按字节续读 → 游标记 size+mtime，变更即整文件重解压重扫（事件 id 幂等去重）。
 */
export const dshProbe: UsageProbe = {
  agent: 'deepseek-harness',
  available(): boolean {
    return zstdDecompressSync() !== null;
  },
  async scan(ctx: ProbeContext): Promise<ProbeScanResult> {
    const result: ProbeScanResult = { events: [], cursors: {}, files: 0 };
    const decompress = zstdDecompressSync();
    if (!decompress) return result;
    const root = join(ctx.homeDir, '.dsh', 'sessions');
    if (!existsSync(root)) return result;
    const known = new Set(ctx.knownSkills());
    for (const proj of readdirSync(root, { withFileTypes: true })) {
      if (!proj.isDirectory()) continue;
      for (const sess of readdirSync(join(root, proj.name), { withFileTypes: true })) {
        if (!sess.isDirectory() || !sess.name.startsWith('session-')) continue;
        const file = join(root, proj.name, sess.name, 'session.jsonl.zstd');
        if (!existsSync(file)) continue;
        const key = `dsh:${file}`;
        result.files += 1;
        try {
          const stat = statSync(file);
          const prev = ctx.cursors[key] as JsonlCursor | undefined;
          const cursor: JsonlCursor = { offset: 0, size: stat.size, mtime: stat.mtimeMs };
          if (prev && prev.size === stat.size && prev.mtime === stat.mtimeMs) {
            result.cursors[key] = cursor;
            continue; // 未变更：跳过整文件重解压
          }
          const text = inflateZstdFrames(readFileSync(file), decompress);
          result.events.push(...eventsFromDshSession(text, file, known));
          result.cursors[key] = cursor;
        } catch {
          /* 单文件失败跳过 */
        }
      }
    }
    return result;
  },
};
