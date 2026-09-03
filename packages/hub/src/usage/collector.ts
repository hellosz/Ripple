import { join } from 'node:path';
import { UsageStore } from './store.js';
import { claudeCodeProbe } from './probe-claude-code.js';
import { codexProbe } from './probe-codex.js';
import { createOpencodeProbe } from './probe-opencode.js';
import { hermesProbe } from './probe-hermes.js';
import { dshProbe } from './probe-dsh.js';
import type { ScanSummary, SkillQualitySignal, UsageEvent, UsageProbe, UsageQuery, UsageSessionEntry, UsageSettings, UsageStatEntry } from './types.js';

export interface UsageCollectorOptions {
  homeDir: string;
  /** 默认 <homeDir>/.ripple/usage */
  usageDir?: string;
  /** hub SSOT 已知技能名（codex 启发式白名单） */
  knownSkills: () => string[];
  /** 采集开关（来自 HubState.usage_collection，默认关闭） */
  settings: () => UsageSettings;
  /** 覆盖 probe 注册表（测试用）；缺省为内置三个 probe */
  probes?: UsageProbe[];
}

/** 内置 probe 注册表：新增 Agent 采集只在此追加条目 */
export function defaultProbes(): UsageProbe[] {
  return [claudeCodeProbe, codexProbe, createOpencodeProbe(), hermesProbe, dshProbe];
}

/**
 * 使用采集内核：probe 注册表 + 增量游标 + 幂等事件存储。
 * 默认关闭（opt-in）；关闭时 scanAll 不读任何证据文件。
 */
export class UsageCollector {
  readonly store: UsageStore;
  private readonly probes: UsageProbe[];

  constructor(private readonly options: UsageCollectorOptions) {
    this.store = new UsageStore(options.usageDir ?? join(options.homeDir, '.ripple', 'usage'));
    this.probes = options.probes ?? defaultProbes();
  }

  /** 该 Agent 当前是否参与采集（enabled=false 全禁；agents[id]===false 单禁） */
  private agentEnabled(agent: string, settings: UsageSettings): boolean {
    if (!settings.enabled) return false;
    return settings.agents[agent] !== false;
  }

  /** 全量/增量扫描全部可用 probe；单 probe 失败不阻塞其他源 */
  async scanAll(): Promise<ScanSummary> {
    const settings = this.options.settings();
    const summary: ScanSummary = { added: 0, sources: [] };
    if (!settings.enabled) return summary;
    const cursors = this.store.loadCursors();
    for (const probe of this.probes) {
      if (!this.agentEnabled(probe.agent, settings)) continue;
      try {
        if (!(await probe.available())) {
          summary.sources.push({ agent: probe.agent, files: 0, added: 0, error: 'unavailable' });
          continue;
        }
        const result = await probe.scan({
          homeDir: this.options.homeDir,
          cursors,
          knownSkills: this.options.knownSkills,
        });
        const added = this.store.append(result.events);
        Object.assign(cursors, result.cursors);
        summary.added += added;
        summary.sources.push({ agent: probe.agent, files: result.files, added });
      } catch (error) {
        summary.sources.push({
          agent: probe.agent,
          files: 0,
          added: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    this.store.saveCursors(cursors);
    return summary;
  }

  /** 聚合统计（skill 维度可再过滤） */
  quality(installedSkills: string[], withReferences: ReadonlySet<string>): SkillQualitySignal[] {
    return this.store.qualitySignals(installedSkills, { withReferences });
  }

  events(query?: UsageQuery): UsageEvent[] {
    return this.store.events(query);
  }

  sessions(query?: UsageQuery): UsageSessionEntry[] {
    return this.store.sessions(query);
  }

  stats(skill?: string): UsageStatEntry[] {
    const stats = this.store.stats();
    return skill ? stats.filter((s) => s.skill === skill) : stats;
  }

  /** 一键清除全部使用数据（事件/游标/聚合） */
  clear(): void {
    this.store.clear();
  }
}
