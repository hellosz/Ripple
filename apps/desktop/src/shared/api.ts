import type {
  BackupRecord,
  CommunitySkill,
  DiscoverIndex,
  DiscoverRepoSkills,
  ScanSummary,
  ScenarioAnalysis,
  UsageStatEntry,
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
import type {
  AiPatch,
  AiScoreResult,
  AiSuggestResult,
  AiUsageEntry,
  Collection,
  SkillListItem,
  User,
} from '@ripple/contract';

export type AiProvider = 'openai' | 'deepseek' | 'custom';

export interface AiConfigPublic {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  hasKey: boolean;
}

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
    hidden_files: string[];
    usage_collection: { enabled: boolean; agents: Record<string, boolean> };
  };
  /** 每个技能 SSOT 内的当前版本与描述（含未纳管但位于共享库中的技能） */
  skills: Record<string, { version: string | null; description: string | null ; /** 是否已在 ~/.agents/skills 共享库（含经共享链接） */ shared: boolean }>;
  /** 全局操作日志（倒序） */
  oplog: OpEntry[];
  /** AI 应用场景分析（skill → 结果） */
  scenarios: Record<string, ScenarioAnalysis>;
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
  /** 本地 Skill 详情：读取全部文件（文本含内容；二进制/超限仅列条目，binary=true，内容经 readSkillAsset 预览） */
  readSkillFiles(
    skill: string,
  ): Promise<Array<{ path: string; content: string; size: number; binary?: boolean }>>;
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

  // ---- AI（本地扩展，多服务商）----
  aiGetConfig(): Promise<AiConfigPublic>;
  aiSetConfig(input: {
    provider: AiProvider;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
  }): Promise<AiConfigPublic>;
  aiTest(): Promise<{ ok: boolean; message: string }>;
  /** SKILL 质量评分（LLM 不可用时降级本地规则评级） */
  aiScore(skill: string, withUsage?: boolean): Promise<AiScoreResult>;
  /** SKILL 优化建议 + 可落盘补丁 */
  aiOptimize(skill: string, withUsage?: boolean): Promise<AiSuggestResult>;
  /** 应用优化补丁（写回 SSOT 并重建 copy 分发） */
  aiApplyPatches(skill: string, patches: AiPatch[]): Promise<{ applied: number }>;
  /** 应用场景分析（本地持久化；指纹一致时直接返回缓存，force 强制重新生成） */
  aiScenario(skill: string, force?: boolean): Promise<ScenarioAnalysis & { stale: boolean }>;
  /** AI 调用用量与费用（最近 200 条 + 合计） */
  /** 任务主日志（批量任务完成后记录；细分日志由各操作自身记录） */
  logTask(title: string, detail: string): Promise<{ ok: boolean }>;
  /** 发现索引（缓存 24h；refresh 强制刷新；degraded 表示配额受限降级） */
  discoverIndex(refresh?: boolean): Promise<DiscoverIndex>;
  /** 仓库技能懒扫描（含本地 S/A/B/C 评级，按 branch+pushed_at 缓存） */
  discoverRepo(owner: string, repo: string, branch?: string, pushedAt?: string | null): Promise<DiscoverRepoSkills>;
  /** GitHub PAT（深度探索用，safeStorage 加密存储；null 清除）；返回是否已配置 */
  discoverSetPat(pat: string | null): Promise<{ configured: boolean }>;
  discoverPatStatus(): Promise<{ configured: boolean }>;
  /** PAT 深搜（未配置 PAT 时报错） */
  discoverDeepSearch(query?: string): Promise<DiscoverIndex['repos']>;
  /** 手动触发使用扫描（记操作日志主日志） */
  usageScan(): Promise<ScanSummary>;
  /** 使用聚合统计（skill 缺省为全部技能） */
  usageStats(skill?: string): Promise<UsageStatEntry[]>;
  /** 读取/设置使用采集开关（传参即设置并重新调度） */
  usageSettings(settings?: { enabled: boolean; agents: Record<string, boolean> }): Promise<{ enabled: boolean; agents: Record<string, boolean> }>;
  /** 清除全部使用数据（事件/游标/聚合） */
  usageClear(): Promise<{ ok: boolean }>;
  aiUsage(): Promise<{
    entries: AiUsageEntry[];
    totals: { calls: number; prompt_tokens: number; completion_tokens: number; cost_usd: number };
  }>;
  /** 读取技能内素材文件（含二进制，base64+mime，≤5MB），供预览 */
  readSkillAsset(skill: string, path: string): Promise<{ base64: string; mime: string; size: number }>;

  // ---- 应用 ----
  appVersion(): Promise<string>;
  /** 手动检查应用更新（GitHub Release 通道；开发模式返回提示） */
  checkAppUpdate(): Promise<{
    current: string;
    latest: string | null;
    available: boolean;
    message?: string;
  }>;
  onDeepLink(cb: (url: string) => void): () => void;
  onUpdaterEvent(
    cb: (event: { type: string; version?: string; percent?: number; message?: string }) => void,
  ): () => void;
  quitAndInstall(): Promise<void>;
}

export const DESKTOP_RPC_CHANNEL = 'ripple:rpc';
export const DEEPLINK_CHANNEL = 'ripple:deeplink';
export const UPDATER_CHANNEL = 'ripple:updater';
