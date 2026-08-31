import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readJsonlIncrement } from './jsonl.js';
import { usageEventId } from './store.js';
import type { JsonlCursor, ProbeContext, ProbeScanResult, UsageEvent, UsageProbe } from './types.js';

/** Claude Code transcript 行信封（只取所需字段） */
interface TranscriptLine {
  type?: string;
  sessionId?: string;
  cwd?: string;
  timestamp?: string;
  uuid?: string;
  message?: { content?: unknown };
}

interface SkillToolUse {
  type: string;
  id?: string;
  name?: string;
  input?: { skill?: unknown };
}

function parseLine(raw: string): TranscriptLine | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as TranscriptLine) : null;
  } catch {
    return null;
  }
}

/** 从一行 transcript 提取 Skill 工具调用事件（结构化证据） */
export function eventsFromClaudeLine(raw: string, file: string, fallbackTime: string): UsageEvent[] {
  const line = parseLine(raw);
  const content = line?.message?.content;
  if (!line || !Array.isArray(content)) return [];
  const sessionId = line.sessionId ?? basename(file).replace(/\.jsonl$/, '');
  const events: UsageEvent[] = [];
  for (const item of content as SkillToolUse[]) {
    if (typeof item !== 'object' || item === null) continue;
    if (item.type !== 'tool_use' || item.name !== 'Skill') continue;
    const skill = typeof item.input?.skill === 'string' ? item.input.skill : null;
    if (!skill) continue;
    const callKey = item.id ?? line.uuid ?? `${file}:${raw.length}`;
    events.push({
      id: usageEventId('claude-code', sessionId, callKey),
      skill,
      agent: 'claude-code',
      session_id: sessionId,
      project_dir: line.cwd ?? '',
      occurred_at: line.timestamp ?? fallbackTime,
      evidence: 'tool-call',
      source_file: file,
    });
  }
  return events;
}

/** Claude Code probe：~/.claude/projects/<路径编码>/<sessionId>.jsonl 中的 Skill 工具调用 */
export const claudeCodeProbe: UsageProbe = {
  agent: 'claude-code',
  available(): boolean {
    return true;
  },
  async scan(ctx: ProbeContext): Promise<ProbeScanResult> {
    const root = join(ctx.homeDir, '.claude', 'projects');
    const result: ProbeScanResult = { events: [], cursors: {}, files: 0 };
    if (!existsSync(root)) return result;
    for (const project of readdirSync(root, { withFileTypes: true })) {
      if (!project.isDirectory()) continue;
      const dir = join(root, project.name);
      for (const entry of readdirSync(dir)) {
        if (!entry.endsWith('.jsonl')) continue;
        const file = join(dir, entry);
        const key = `claude-code:${file}`;
        result.files += 1;
        try {
          const fallbackTime = new Date(statSync(file).mtimeMs).toISOString();
          const { lines, cursor } = await readJsonlIncrement(file, ctx.cursors[key] as JsonlCursor | undefined);
          for (const raw of lines) result.events.push(...eventsFromClaudeLine(raw, file, fallbackTime));
          result.cursors[key] = cursor;
        } catch {
          /* 单文件解析失败跳过，不阻塞其他文件 */
        }
      }
    }
    return result;
  },
};
