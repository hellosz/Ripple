import type {
  BackupRecord,
  CommunitySkill,
  DetectedAgent,
  DistMode,
  HistoryEntry,
  InstallRecord,
  InstallTarget,
  OpEntry,
  ProjectRecord,
  RepoSkill,
  ScanIssue,
  SourceRepo,
  StorageLocation,
} from '@ripple/hub';
import type { Collection, SkillListItem, User } from '@ripple/contract';

export interface AgentSummary extends DetectedAgent {
  installCount: number;
}

export interface HubSnapshot {
  installs: InstallRecord[];
  projects: ProjectRecord[];
  sources: SourceRepo[];
  backups: BackupRecord[];
  history: Record<string, HistoryEntry[]>;
  agents: AgentSummary[];
  conflicts: Record<string, string[]>;
  settings: {
    storage_location: StorageLocation;
    dist_mode: DistMode;
    default_agent: string;
    storage_dir: string;
    backups_dir: string;
  };
  /** 每个技能 SSOT 内的当前版本与描述（含未纳管但位于共享库中的技能） */
  skills: Record<string, { version: string | null; description: string | null }>;
  /** 全局操作日志（倒序） */
  oplog: OpEntry[];
}

export interface AuthState {
  server: string;
  loggedIn: boolean;
  user: User | null;
}

export interface UpdateEntry {
  skill: string;
  current: string | null;
  latest: string;
  targets: number;
}

/** 渲染进程可用的桌面 API（preload contextBridge 暴露；main 进程实现） */
export interface DesktopApi {
  // ---- hub（本地，无需登录）----
  snapshot(): Promise<HubSnapshot>;
  scan(): Promise<ScanIssue[]>;
  /** 接管 Agent/项目目录中未纳管的既有技能 */
  adoptAll(): Promise<{ adopted: number; skipped: number }>;
  /** Agent 粒度补齐：把 SSOT 已有技能补装到指定目标（target.dedicated=true 强制专属） */
  addPlacement(skill: string, target: InstallTarget): Promise<InstallRecord>;
  /** 按 Agent 批量备份其全部技能 */
  backupAgents(agentIds: string[]): Promise<{ count: number }>;
  /** 批量：把当前全部技能补齐到某 Agent（内容不变，免备份） */
  applyAllToAgent(agentId: string, skills?: string[]): Promise<{ count: number }>;
  /** 批量：移除某 Agent 的全部全局 placement（SSOT 保留） */
  removeAllFromAgent(agentId: string): Promise<{ count: number }>;
  /** 本地 Skill 详情：读取全部文本文件（SKILL.md 置顶） */
  readSkillFiles(skill: string): Promise<Array<{ path: string; content: string; size: number }>>;
  /** 编辑保存：写回 SSOT 并重建 copy 型分发 */
  writeSkillFile(skill: string, path: string, content: string): Promise<void>;
  /** 社区开源快照（逐来源技能 + 指纹比对 + 更新时间，本地即可用无需登录） */
  community(): Promise<CommunitySkill[]>;
  sync(skill: string, targets: InstallTarget[]): Promise<InstallRecord[]>;
  setEnabled(skill: string, target: InstallTarget, enabled: boolean): Promise<InstallRecord>;
  uninstall(skill: string, target?: InstallTarget): Promise<void>;
  unifyVersions(skill: string): Promise<void>;
  restoreBackup(id: string): Promise<BackupRecord>;
  deleteBackup(id: string): Promise<void>;
  setStorageLocation(location: StorageLocation): Promise<void>;
  setDistMode(mode: DistMode): Promise<void>;
  addSource(spec: string): Promise<SourceRepo>;
  removeSource(id: string): Promise<void>;
  listRepoSkills(sourceId: string): Promise<RepoSkill[]>;
  installFromRepo(sourceId: string, skill: string, targets: InstallTarget[]): Promise<InstallRecord[]>;
  /** 打开目录选择器添加项目；用户取消返回 null */
  addProjectDialog(): Promise<ProjectRecord | null>;
  removeProject(path: string): Promise<void>;
  /** 打开文件选择器导入 ZIP；用户取消返回 null */
  importZipDialog(targets: InstallTarget[]): Promise<InstallRecord[] | null>;

  // ---- 远程服务（需登录）----
  authState(): Promise<AuthState>;
  login(server: string, email: string, password: string): Promise<AuthState>;
  logout(): Promise<AuthState>;
  setServer(server: string): Promise<AuthState>;
  market(query: { search?: string; sort_by?: string; page_size?: number }): Promise<SkillListItem[]>;
  collections(): Promise<Collection[]>;
  checkUpdates(): Promise<UpdateEntry[]>;
  installFromRegistry(skill: string, targets: InstallTarget[]): Promise<InstallRecord[]>;
  updateAll(): Promise<UpdateEntry[]>;

  // ---- 应用 ----
  appVersion(): Promise<string>;
  onDeepLink(cb: (url: string) => void): () => void;
  onUpdaterEvent(cb: (event: { type: string; version?: string }) => void): () => void;
  quitAndInstall(): Promise<void>;
}

export const DESKTOP_RPC_CHANNEL = 'ripple:rpc';
export const DEEPLINK_CHANNEL = 'ripple:deeplink';
export const UPDATER_CHANNEL = 'ripple:updater';
