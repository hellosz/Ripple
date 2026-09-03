import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { SkillQualitySignal, UsageCursor, UsageEvent, UsageQuery, UsageSessionEntry, UsageStatEntry } from './types.js';

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
  /** 事件是否为触发事件（resource 缺省或 skill；reference/script 为跟随访问） */
  private static isTrigger(e: UsageEvent): boolean {
    return !e.resource || e.resource === 'skill';
  }

  /** 事件明细查询（只读）：过滤 + 按发生时间倒序 + limit。缺省含跟随事件（明细时间线需要） */
  events(query: UsageQuery = {}): UsageEvent[] {
    const all = this.listShards()
      .flatMap((s) => this.readShardEvents(s))
      .filter(
        (e) =>
          (!query.skill || e.skill === query.skill) &&
          (!query.agent || e.agent === query.agent) &&
          (!query.session_id || e.session_id === query.session_id),
      )
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    return query.limit ? all.slice(0, query.limit) : all;
  }

  /** 会话聚合查询（只读）：agent+session 分组，按最近活动倒序 */
  sessions(query: UsageQuery = {}): UsageSessionEntry[] {
    const byKey = new Map<string, UsageSessionEntry>();
    for (const e of this.events({ ...(query.skill ? { skill: query.skill } : {}), ...(query.agent ? { agent: query.agent } : {}) })) {
      if (!UsageStore.isTrigger(e)) continue; // 会话聚合只计触发事件
      const key = `${e.agent}\n${e.session_id}`;
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          agent: e.agent,
          session_id: e.session_id,
          project_dir: e.project_dir,
          first_at: e.occurred_at,
          last_at: e.occurred_at,
          count: 0,
          skills: {},
        };
        byKey.set(key, entry);
      }
      if (e.occurred_at < entry.first_at) entry.first_at = e.occurred_at;
      if (e.occurred_at > entry.last_at) entry.last_at = e.occurred_at;
      if (e.project_dir && !entry.project_dir) entry.project_dir = e.project_dir;
      entry.count += 1;
      entry.skills[e.skill] = (entry.skills[e.skill] ?? 0) + 1;
    }
    const sorted = [...byKey.values()].sort((a, b) => b.last_at.localeCompare(a.last_at));
    return query.limit ? sorted.slice(0, query.limit) : sorted;
  }

  /** 质量信号聚合（读侧派生；installed 中无事件的技能标记从未使用） */
  qualitySignals(
    installedSkills: string[] = [],
    opts: { withReferences?: ReadonlySet<string>; now?: Date } = {},
  ): SkillQualitySignal[] {
    const now = opts.now ?? new Date();
    const all = this.listShards().flatMap((s) => this.readShardEvents(s));
    // 会话 → 触发技能集合（共现/重复加载用）
    const sessionSkills = new Map<string, Map<string, number>>();
    const sessionFollow = new Map<string, Set<string>>(); // `${sess}` → 有 reference/script 跟随的 `skill|resource`
    interface Acc {
      triggers: number;
      manual: number;
      trigWithTag: number;
      sessions: Set<string>;
      last: string | null;
    }
    const acc = new Map<string, Acc>();
    for (const e of all) {
      const sessKey = `${e.agent}\n${e.session_id}`;
      if (UsageStore.isTrigger(e)) {
        let a = acc.get(e.skill);
        if (!a) {
          a = { triggers: 0, manual: 0, trigWithTag: 0, sessions: new Set(), last: null };
          acc.set(e.skill, a);
        }
        a.triggers += 1;
        a.sessions.add(sessKey);
        if (e.trigger) {
          a.trigWithTag += 1;
          if (e.trigger === 'manual') a.manual += 1;
        }
        if (!a.last || e.occurred_at > a.last) a.last = e.occurred_at;
        let bySkill = sessionSkills.get(sessKey);
        if (!bySkill) {
          bySkill = new Map();
          sessionSkills.set(sessKey, bySkill);
        }
        bySkill.set(e.skill, (bySkill.get(e.skill) ?? 0) + 1);
      } else {
        let f = sessionFollow.get(sessKey);
        if (!f) {
          f = new Set();
          sessionFollow.set(sessKey, f);
        }
        f.add(`${e.skill}|${e.resource}`);
      }
    }
    const skills = new Set<string>([...acc.keys(), ...installedSkills]);
    const result: SkillQualitySignal[] = [];
    for (const skill of skills) {
      const a = acc.get(skill);
      // 共现：同会话触发过的其他技能
      const co = new Map<string, number>();
      let repeat = 0;
      let refSessions = 0;
      let scriptSessions = 0;
      if (a) {
        for (const sessKey of a.sessions) {
          const bySkill = sessionSkills.get(sessKey)!;
          if ((bySkill.get(skill) ?? 0) >= 2) repeat += 1;
          for (const other of bySkill.keys()) {
            if (other !== skill) co.set(other, (co.get(other) ?? 0) + 1);
          }
          const follow = sessionFollow.get(sessKey);
          if (follow?.has(`${skill}|reference`)) refSessions += 1;
          if (follow?.has(`${skill}|script`)) scriptSessions += 1;
        }
      }
      const sessions = a?.sessions.size ?? 0;
      const manualRatio = a && a.trigWithTag > 0 ? a.manual / a.trigWithTag : null;
      const staleDays = a?.last
        ? Math.floor((now.getTime() - new Date(a.last).getTime()) / 86_400_000)
        : null;
      const labels: SkillQualitySignal['labels'] = [];
      if (a && manualRatio !== null && manualRatio >= 0.5 && a.triggers >= 4) labels.push('触发失灵');
      if (a && sessions >= 3 && refSessions === 0 && opts.withReferences?.has(skill)) labels.push('死重 references');
      if (!a || (staleDays !== null && staleDays >= 90)) labels.push('淘汰候选');
      if (a && sessions >= 3 && repeat / sessions >= 0.3) labels.push('token 冗长嫌疑');
      result.push({
        skill,
        triggers: a?.triggers ?? 0,
        manual_ratio: manualRatio,
        sessions,
        repeat_sessions: repeat,
        co_occurs: [...co.entries()]
          .sort((x, y) => y[1] - x[1])
          .slice(0, 3)
          .map(([name, n]) => ({ skill: name, sessions: n })),
        last_used: a?.last ?? null,
        stale_days: staleDays,
        never_used: !a,
        reference_follow_rate: sessions > 0 ? refSessions / sessions : null,
        script_follow_rate: sessions > 0 ? scriptSessions / sessions : null,
        labels,
      });
    }
    return result.sort((x, y) => y.triggers - x.triggers);
  }

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
      if (!UsageStore.isTrigger(event)) continue; // 使用次数只计触发事件
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
