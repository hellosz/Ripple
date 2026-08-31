import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readJsonlIncrement } from './jsonl.js';
import { usageEventId } from './store.js';
import type { JsonlCursor, ProbeContext, ProbeScanResult, UsageEvent, UsageProbe } from './types.js';

interface HermesToolLine {
  role?: string;
  name?: string;
  content?: string;
  tool_call_id?: string;
  timestamp?: string;
}

/**
 * 从一行 Hermes 会话记录提取 skill_view 使用事件（结构化 tool-call 证据）。
 * 仅认 role=tool 且 name=skill_view 的成功结果行；session_meta 的技能清单注入不计为使用。
 */
export function eventFromHermesLine(
  raw: string,
  file: string,
  fallbackTime: string,
): UsageEvent | null {
  if (!raw.includes('"skill_view"')) return null;
  let parsed: HermesToolLine;
  try {
    parsed = JSON.parse(raw) as HermesToolLine;
  } catch {
    return null;
  }
  if (parsed.role !== 'tool' || parsed.name !== 'skill_view') return null;
  let skill: string | null = null;
  try {
    const inner = JSON.parse(parsed.content ?? '') as { success?: boolean; name?: string };
    if (inner.success === false) return null;
    skill = typeof inner.name === 'string' && inner.name ? inner.name : null;
  } catch {
    return null;
  }
  if (!skill) return null;
  const sessionId = basename(file).replace(/\.jsonl$/, '');
  return {
    id: usageEventId('hermes', sessionId, parsed.tool_call_id ?? raw),
    skill,
    agent: 'hermes',
    session_id: sessionId,
    project_dir: '',
    occurred_at: parsed.timestamp ?? fallbackTime,
    evidence: 'tool-call',
    source_file: file,
  };
}

/** Hermes probe：~/.hermes/sessions/*.jsonl 的 skill_view 工具调用（结构化证据） */
export const hermesProbe: UsageProbe = {
  agent: 'hermes',
  available(): boolean {
    return true;
  },
  async scan(ctx: ProbeContext): Promise<ProbeScanResult> {
    const root = join(ctx.homeDir, '.hermes', 'sessions');
    const result: ProbeScanResult = { events: [], cursors: {}, files: 0 };
    if (!existsSync(root)) return result;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
      const file = join(root, entry.name);
      const key = `hermes:${file}`;
      result.files += 1;
      try {
        const { lines, cursor } = await readJsonlIncrement(file, ctx.cursors[key] as JsonlCursor | undefined);
        const fallbackTime = new Date(cursor.mtime).toISOString();
        for (const raw of lines) {
          const event = eventFromHermesLine(raw, file, fallbackTime);
          if (event) result.events.push(event);
        }
        result.cursors[key] = cursor;
      } catch {
        /* 单文件失败跳过 */
      }
    }
    return result;
  },
};
