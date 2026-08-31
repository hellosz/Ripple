import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { UsageCursor, UsageEvent, UsageStatEntry } from './types.js';

/** 事件 id：幂等去重的唯一来源 */
export function usageEventId(agent: string, sessionId: string, callKey: string): string {
  return createHash('sha256').update(`${agent}\n${sessionId}\n${callKey}`).digest('hex').slice(0, 16);
}

/** 事件所属分片文件名（按发生时间分月；时间非法归入 unknown 分片） */
function shardName(occurredAt: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(occurredAt);
  return m ? `events-${m[1]}-${m[2]}.jsonl` : 'events-unknown.jsonl';
}

/**
 * 使用事件存储：JSONL 分月分片 + 游标 + 聚合缓存。
 * 全部数据在 usageDir 下，可整目录删除重建。
 */
export class UsageStore {
  constructor(private readonly usageDir: string) {}

  private shardFile(name: string): string {
    return join(this.usageDir, name);
  }

  private listShards(): string[] {
    if (!existsSync(this.usageDir)) return [];
    return readdirSync(this.usageDir)
      .filter((f) => /^events-.*\.jsonl$/.test(f))
      .sort();
  }

  private readShardEvents(name: string): UsageEvent[] {
    const file = this.shardFile(name);
    if (!existsSync(file)) return [];
    const events: UsageEvent[] = [];
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line) as UsageEvent);
      } catch {
        /* 半写坏行跳过 */
      }
    }
    return events;
  }

  /** 追加事件（按 id 去重，同分片内幂等）；返回实际新增数 */
  append(events: UsageEvent[]): number {
    if (events.length === 0) return 0;
    mkdirSync(this.usageDir, { recursive: true });
    // 按目标分片分组，各分片加载既有 id 集合去重
    const byShard = new Map<string, UsageEvent[]>();
    for (const event of events) {
      const shard = shardName(event.occurred_at);
      const list = byShard.get(shard) ?? [];
      list.push(event);
      byShard.set(shard, list);
    }
    let added = 0;
    for (const [shard, list] of byShard) {
      const seen = new Set(this.readShardEvents(shard).map((e) => e.id));
      const fresh = list.filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      if (fresh.length === 0) continue;
      appendFileSync(this.shardFile(shard), fresh.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
      added += fresh.length;
    }
    if (added > 0) this.rebuildStats();
    return added;
  }

  /** 全量事件（跨分片，按发生时间升序） */
  allEvents(): UsageEvent[] {
    const events = this.listShards().flatMap((s) => this.readShardEvents(s));
    return events.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  }

  /** 聚合统计：优先读 stats.json 缓存，缺失/损坏由明细重建 */
  stats(): UsageStatEntry[] {
    const file = join(this.usageDir, 'stats.json');
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as UsageStatEntry[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* 走重建 */
    }
    return this.rebuildStats();
  }

  /** 由事件明细重建聚合并写缓存 */
  rebuildStats(): UsageStatEntry[] {
    const byKey = new Map<string, UsageStatEntry>();
    for (const event of this.allEvents()) {
      const key = `${event.skill}\n${event.agent}`;
      const entry = byKey.get(key) ?? {
        skill: event.skill,
        agent: event.agent,
        count: 0,
        first_at: event.occurred_at,
        last_at: event.occurred_at,
        projects: {},
      };
      entry.count += 1;
      if (event.occurred_at < entry.first_at) entry.first_at = event.occurred_at;
      if (event.occurred_at > entry.last_at) entry.last_at = event.occurred_at;
      if (event.project_dir) entry.projects[event.project_dir] = (entry.projects[event.project_dir] ?? 0) + 1;
      byKey.set(key, entry);
    }
    const stats = [...byKey.values()].sort((a, b) => b.count - a.count);
    if (existsSync(this.usageDir) || stats.length > 0) {
      mkdirSync(this.usageDir, { recursive: true });
      writeFileSync(join(this.usageDir, 'stats.json'), JSON.stringify(stats, null, 2), 'utf8');
    }
    return stats;
  }

  /** 证据源游标（source_key → 游标） */
  loadCursors(): Record<string, UsageCursor> {
    try {
      return JSON.parse(readFileSync(join(this.usageDir, 'cursors.json'), 'utf8')) as Record<string, UsageCursor>;
    } catch {
      return {};
    }
  }

  saveCursors(cursors: Record<string, UsageCursor>): void {
    mkdirSync(this.usageDir, { recursive: true });
    writeFileSync(join(this.usageDir, 'cursors.json'), JSON.stringify(cursors, null, 2), 'utf8');
  }

  /** 一键清除：事件、游标、聚合全删 */
  clear(): void {
    rmSync(this.usageDir, { recursive: true, force: true });
  }
}
