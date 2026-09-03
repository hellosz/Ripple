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

/** slash 手动触发：user 行的 <command-name>/name</command-name>，去前导 / 与命名空间前缀后须精确命中本地技能名 */
const COMMAND_NAME_RE = /<command-name>\/?([\w:./-]+)<\/command-name>/;
/** 技能内子资源访问（references/scripts）：跟随事件，不计入使用次数 */
const RESOURCE_RE = /skills\/([a-z0-9][a-z0-9-]*)\/(references|scripts)\//g;

/** 从一行 transcript 提取使用事件：Skill 工具调用（auto）、slash 命令（manual）、references/scripts 跟随 */
export function eventsFromClaudeLine(
  raw: string,
  file: string,
  fallbackTime: string,
  known: ReadonlySet<string> = new Set(),
): UsageEvent[] {
  const line = parseLine(raw);
  if (!line) return [];
  const sessionId = line.sessionId ?? basename(file).replace(/\.jsonl$/, '');
  const base = {
    agent: 'claude-code' as const,
    session_id: sessionId,
    project_dir: line.cwd ?? '',
    occurred_at: line.timestamp ?? fallbackTime,
    evidence: 'tool-call' as const,
    source_file: file,
  };
  const events: UsageEvent[] = [];
  const content = line.message?.content;
  if (Array.isArray(content)) {
    for (const item of content as SkillToolUse[]) {
      if (typeof item !== 'object' || item === null) continue;
      if (item.type !== 'tool_use' || item.name !== 'Skill') continue;
      const skill = typeof item.input?.skill === 'string' ? item.input.skill : null;
      if (!skill) continue;
      const callKey = item.id ?? line.uuid ?? `${file}:${raw.length}`;
      events.push({ ...base, id: usageEventId('claude-code', sessionId, callKey), skill, trigger: 'auto' });
    }
  }
  // manual：仅 user 行，且命令名精确命中本地技能（防插件命名空间误报，宁漏勿误）
  if (line.type === 'user' && raw.includes('<command-name>')) {
    const m = COMMAND_NAME_RE.exec(raw);
    if (m) {
      const name = m[1]!.replace(/^.*[:/]/, '');
      if (known.has(name)) {
        events.push({
          ...base,
          id: usageEventId('claude-code', sessionId, `cmd:${line.uuid ?? raw.slice(0, 80)}`),
          skill: name,
          trigger: 'manual',
        });
      }
    }
  }
  // references/scripts 跟随（路径可出现在任意工具入参中；技能名过白名单）
  if (raw.includes('skills/')) {
    const seen = new Set<string>();
    for (const match of raw.matchAll(RESOURCE_RE)) {
      const skill = match[1]!;
      const resource = match[2] === 'references' ? ('reference' as const) : ('script' as const);
      const key = `${skill}|${resource}`;
      if (!known.has(skill) || seen.has(key)) continue;
      seen.add(key);
      events.push({
        ...base,
        id: usageEventId('claude-code', sessionId, `res:${key}:${line.uuid ?? raw.slice(0, 80)}`),
        skill,
        evidence: 'path-heuristic',
        resource,
      });
    }
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
    const known = new Set(ctx.knownSkills());
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
          for (const raw of lines) result.events.push(...eventsFromClaudeLine(raw, file, fallbackTime, known));
          result.cursors[key] = cursor;
        } catch {
          /* 单文件解析失败跳过，不阻塞其他文件 */
        }
      }
    }
    return result;
  },
};
