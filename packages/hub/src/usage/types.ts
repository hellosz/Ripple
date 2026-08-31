/** 使用证据等级：结构化工具调用 / SKILL.md 路径启发式 */
export type UsageEvidence = 'tool-call' | 'path-heuristic';

/** 一条技能使用事件（append-only，id 幂等） */
export interface UsageEvent {
  /** sha256(agent + session_id + 调用标识) 前 16 hex */
  id: string;
  skill: string;
  /** AGENT_ADAPTERS 中的 agent id */
  agent: string;
  session_id: string;
  /** 会话工作目录（可关联 hub 项目）；未知为空串 */
  project_dir: string;
  /** ISO 时间 */
  occurred_at: string;
  evidence: UsageEvidence;
  /** 证据文件路径（transcript/db） */
  source_file: string;
}

/** jsonl 证据源游标：字节偏移 + 截断检测 */
export interface JsonlCursor {
  offset: number;
  size: number;
  mtime: number;
}

/** SQLite 证据源游标：时间水位 */
export interface WatermarkCursor {
  watermark: number;
}

export type UsageCursor = JsonlCursor | WatermarkCursor;

/** 按 skill × agent 的聚合统计（可由明细完整重建） */
export interface UsageStatEntry {
  skill: string;
  agent: string;
  count: number;
  first_at: string;
  last_at: string;
  /** 项目分布：project_dir → 次数 */
  projects: Record<string, number>;
}

export interface UsageSettings {
  enabled: boolean;
  /** 按 Agent 覆盖：false 为单独禁用，缺省跟随 enabled */
  agents: Record<string, boolean>;
}

/** 单个证据源（probe）扫描结果 */
export interface ProbeScanResult {
  events: UsageEvent[];
  /** source_key → 新游标 */
  cursors: Record<string, UsageCursor>;
  /** 本次实际检查的证据文件数 */
  files: number;
}

export interface ProbeContext {
  homeDir: string;
  /** source_key → 既有游标 */
  cursors: Record<string, UsageCursor>;
  /** hub SSOT 中已知技能名（启发式白名单用） */
  knownSkills: () => string[];
}

/** Usage probe：每个 Agent 一个条目；新增 Agent 只加注册表条目，不改内核 */
export interface UsageProbe {
  agent: string;
  /** 运行时可用性探测（如 node:sqlite 缺失则 false） */
  available(): boolean | Promise<boolean>;
  scan(ctx: ProbeContext): Promise<ProbeScanResult>;
}

/** scanAll 汇总：每个 probe 一条 source 记录，失败不阻塞其他源 */
export interface ScanSummary {
  added: number;
  sources: Array<{ agent: string; files: number; added: number; error?: string }>;
}
