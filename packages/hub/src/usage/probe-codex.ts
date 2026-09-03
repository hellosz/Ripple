import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readJsonlIncrement } from './jsonl.js';
import { usageEventId } from './store.js';
import type { JsonlCursor, ProbeContext, ProbeScanResult, UsageEvent, UsageProbe } from './types.js';

const SKILL_PATH_RE = /skills\/([a-z0-9][a-z0-9-]*)\/SKILL\.md/g;
const RESOURCE_RE = /skills\/([a-z0-9][a-z0-9-]*)\/(references|scripts)\//g;

/**
 * 从一行 rollout 记录启发式提取技能使用（读取 SKILL.md 路径）。
 * 仅保留 hub SSOT 已知技能名（白名单防误报）；同行多次命中同技能去重。
 * 调用标识用行原文（usageEventId 内部哈希），增量/截断重扫序列下 id 稳定。
 */
export function eventsFromCodexLine(
  raw: string,
  file: string,
  known: ReadonlySet<string>,
  fallbackTime: string,
): UsageEvent[] {
  const sessionId = basename(file).replace(/\.jsonl$/, '');
  let occurredAt = fallbackTime;
  try {
    const parsed = JSON.parse(raw) as { timestamp?: string };
    if (typeof parsed.timestamp === 'string') occurredAt = parsed.timestamp;
  } catch {
    /* 非 JSON 行也允许正则匹配 */
  }
  const skills = new Set<string>();
  for (const match of raw.matchAll(SKILL_PATH_RE)) {
    const name = match[1]!;
    if (known.has(name)) skills.add(name);
  }
  const events: UsageEvent[] = [...skills].map((skill) => ({
    id: usageEventId('codex', sessionId, `${raw}\n${skill}`),
    skill,
    agent: 'codex',
    session_id: sessionId,
    project_dir: '',
    occurred_at: occurredAt,
    evidence: 'path-heuristic' as const,
    source_file: file,
  }));
  // references/scripts 跟随访问（不计入使用次数）
  const seen = new Set<string>();
  for (const match of raw.matchAll(RESOURCE_RE)) {
    const skill = match[1]!;
    const resource = match[2] === 'references' ? ('reference' as const) : ('script' as const);
    const key = `${skill}|${resource}`;
    if (!known.has(skill) || seen.has(key)) continue;
    seen.add(key);
    events.push({
      id: usageEventId('codex', sessionId, `res:${key}:${raw}`),
      skill,
      agent: 'codex',
      session_id: sessionId,
      project_dir: '',
      occurred_at: occurredAt,
      evidence: 'path-heuristic',
      source_file: file,
      resource,
    });
  }
  return events;
}

function* walkJsonl(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkJsonl(full);
    else if (entry.isFile() && /^rollout-.*\.jsonl$/.test(entry.name)) yield full;
  }
}

/** Codex probe：~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl 的 SKILL.md 路径启发式 */
export const codexProbe: UsageProbe = {
  agent: 'codex',
  available(): boolean {
    return true;
  },
  async scan(ctx: ProbeContext): Promise<ProbeScanResult> {
    const root = join(ctx.homeDir, '.codex', 'sessions');
    const result: ProbeScanResult = { events: [], cursors: {}, files: 0 };
    if (!existsSync(root)) return result;
    const known = new Set(ctx.knownSkills());
    for (const file of walkJsonl(root)) {
      const key = `codex:${file}`;
      result.files += 1;
      try {
        const fallbackTime = new Date(statSync(file).mtimeMs).toISOString();
        const { lines, cursor } = await readJsonlIncrement(file, ctx.cursors[key] as JsonlCursor | undefined);
        for (const raw of lines) result.events.push(...eventsFromCodexLine(raw, file, known, fallbackTime));
        result.cursors[key] = cursor;
      } catch {
        /* 单文件失败跳过 */
      }
    }
    return result;
  },
};
