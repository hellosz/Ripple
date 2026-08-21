export type StorageLocation = 'builtin' | 'shared';
export type DistMode = 'symlink' | 'copy';
/** 实际落盘方式（symlink 失败降级 copy 会被记录） */
export type EffectiveMode = 'symlink' | 'junction' | 'copy' | 'shared';

export interface InstallRecord {
  skill: string;
  version: string;
  agent: string;
  /** 'global' 或项目目录绝对路径 */
  scope: string;
  enabled: boolean;
  mode: EffectiveMode;
  installed_at: string;
  /** 来源标识：registry / repo:<sourceId> / zip / adopt / local */
  origin?: string;
}

/** 社区来源技能条目（含本地状态） */
export interface CommunitySkill {
  sourceId: string;
  name: string;
  description: string;
  version: string;
  fingerprint: string;
  installed: boolean;
  /** 本地 SSOT 指纹（无内容为 null） */
  localFingerprint: string | null;
  /** 远端指纹 ≠ 本地指纹（本地存在时） */
  changed: boolean;
  /** 该技能子路径最近提交时间（best-effort，可能为 null） */
  remoteUpdatedAt: string | null;
}

export interface ProjectRecord {
  /** 项目目录绝对路径 */
  path: string;
  name: string;
  added_at: string;
}

export interface SourceRepo {
  id: string;
  owner: string;
  repo: string;
  branch: string;
  subdir: string;
  note: string;
  builtin: boolean;
  /** github（codeload）或 gitlab（含私服，public 仓库 /-/archive） */
  provider?: 'github' | 'gitlab';
  /** gitlab 私服主机名（github 省略） */
  host?: string;
}

export interface HistoryEntry {
  action: 'install' | 'update' | 'sync' | 'rollback' | 'restore' | 'uninstall';
  version: string;
  detail: string;
  at: string;
}

export interface BackupRecord {
  id: string;
  skill: string;
  version: string;
  reason: string;
  size: number;
  created_at: string;
  file: string;
}

export interface HubState {
  schema_version: 1;
  storage_location: StorageLocation;
  dist_mode: DistMode;
  default_agent: string;
  installs: InstallRecord[];
  projects: ProjectRecord[];
  sources: SourceRepo[];
  history: Record<string, HistoryEntry[]>;
  backups: BackupRecord[];
  /** hub 写入 SSOT 的技能（所有权）；卸载时仅 owned 才删除 SSOT 内容 */
  owned: Record<string, true>;
  /** 全局操作日志（最近 500 条，倒序） */
  oplog: OpEntry[];
}

export interface InstallTarget {
  agent: string;
  /** 缺省为全局；项目作用域传项目目录绝对路径 */
  projectDir?: string;
  /** Agent 粒度个性化：强制专属分发（即使该 Agent 支持共享目录标准） */
  dedicated?: boolean;
}

/** 全局操作日志条目 */
export interface OpEntry {
  at: string;
  action: string;
  target: string;
  detail: string;
}

export interface AgentAdapter {
  id: string;
  name: string;
  /** 相对 home 的全局技能目录 */
  globalRelPath: string;
  /** 项目内技能目录（相对项目根） */
  projectRelPath: string;
  /** 是否原生支持 agentskills.io 共享目录 ~/.agents/skills */
  sharedDirSupport: boolean;
}

export interface DetectedAgent extends AgentAdapter {
  detected: boolean;
  globalPath: string;
}

export interface ScanIssue {
  kind: 'unmanaged' | 'version-conflict' | 'missing';
  skill: string;
  detail: string;
}

/** Agent/项目目录中未被 hub 纳管的既有技能 */
export interface UnmanagedSkill {
  skill: string;
  agent: string;
  scope: string;
  path: string;
  version: string | null;
  hasSkillMd: boolean;
}
