import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { usageEventId } from './store.js';
import type { ProbeContext, ProbeScanResult, UsageEvent, UsageProbe, WatermarkCursor } from './types.js';

/** node:sqlite 的最小使用面（便于注入与 mock） */
export interface SqliteModule {
  DatabaseSync: new (
    path: string,
    options?: { readOnly?: boolean },
  ) => {
    prepare(sql: string): { all(...params: unknown[]): unknown[] };
    close(): void;
  };
}

export type SqliteLoader = () => Promise<SqliteModule>;

/** 默认 loader：Node ≥ 22.5 提供 node:sqlite；CLI Node 20 下 import 失败 → probe 不可用 */
export const defaultSqliteLoader: SqliteLoader = async () => (await import('node:sqlite')) as unknown as SqliteModule;

interface PartRow {
  id?: unknown;
  session_id?: unknown;
  data?: unknown;
  time_created?: unknown;
  directory?: unknown;
}

/** part.data JSON 中的 skill 工具调用形态：{"type":"tool","tool":"skill","state":{"input":{"name":...}}} */
function skillFromPartData(data: unknown): string | null {
  if (typeof data !== 'string') return null;
  try {
    const parsed = JSON.parse(data) as { type?: string; tool?: string; state?: { input?: { name?: unknown } } };
    if (parsed.type !== 'tool' || parsed.tool !== 'skill') return null;
    return typeof parsed.state?.input?.name === 'string' ? parsed.state.input.name : null;
  } catch {
    return null;
  }
}

/** OpenCode probe：只读查询 opencode.db 的 skill 工具调用（结构化证据，时间水位游标） */
export function createOpencodeProbe(loader: SqliteLoader = defaultSqliteLoader): UsageProbe {
  return {
    agent: 'opencode',
    async available(): Promise<boolean> {
      try {
        await loader();
        return true;
      } catch {
        return false;
      }
    },
    async scan(ctx: ProbeContext): Promise<ProbeScanResult> {
      const dbPath = join(ctx.homeDir, '.local', 'share', 'opencode', 'opencode.db');
      const result: ProbeScanResult = { events: [], cursors: {}, files: 0 };
      if (!existsSync(dbPath)) return result;
      result.files = 1;
      const key = `opencode:${dbPath}`;
      const prev = ctx.cursors[key] as WatermarkCursor | undefined;
      const watermark = prev?.watermark ?? 0;
      const sqlite = await loader();
      const db = new sqlite.DatabaseSync(dbPath, { readOnly: true });
      try {
        const rows = db
          .prepare(
            `SELECT p.id, p.session_id, p.data, p.time_created, s.directory
             FROM part p LEFT JOIN session s ON s.id = p.session_id
             WHERE p.data LIKE '%"tool":"skill"%' AND p.time_created > ?
             ORDER BY p.time_created ASC`,
          )
          .all(watermark) as PartRow[];
        let next = watermark;
        for (const row of rows) {
          const skill = skillFromPartData(row.data);
          const timeCreated = typeof row.time_created === 'number' ? row.time_created : 0;
          if (timeCreated > next) next = timeCreated;
          if (!skill) continue;
          const sessionId = typeof row.session_id === 'string' ? row.session_id : '';
          const events: UsageEvent = {
            id: usageEventId('opencode', sessionId, String(row.id ?? timeCreated)),
            skill,
            agent: 'opencode',
            session_id: sessionId,
            project_dir: typeof row.directory === 'string' ? row.directory : '',
            occurred_at: new Date(timeCreated).toISOString(),
            evidence: 'tool-call',
            source_file: dbPath,
          };
          result.events.push(events);
        }
        result.cursors[key] = { watermark: next };
      } finally {
        db.close();
      }
      return result;
    },
  };
}
