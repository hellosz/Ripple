export type StorageLocation = 'builtin' | 'shared';
export type DistMode = 'symlink' | 'copy';
/** 实际落盘方式（symlink 失败降级 copy 会被记录） */
export type EffectiveMode = 'symlink' | 'junction' | 'copy';

export interface InstallRecord {
  skill: string;
  version: string;
  agent: string;
  /** 'global' 或项目目录绝对路径 */
  scope: string;
  enabled: boolean;
  mode: EffectiveMode;
  installed_at: string;
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
}

export interface InstallTarget {
  agent: string;
  /** 缺省为全局；项目作用域传项目目录绝对路径 */
  projectDir?: string;
}

export interface AgentAdapter {
  id: string;
  name: string;
  /** 相对 home 的全局技能目录 */
  globalRelPath: string;
  /** 项目内技能目录（相对项目根） */
  projectRelPath: string;
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
