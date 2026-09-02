import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Collection, SkillListItem } from '@ripple/contract';
import type { CommunitySkill } from '@ripple/hub';
import type { AuthState, HubSnapshot, UpdateEntry } from '../../shared/api.js';
import { ripple } from './ripple-api.js';

export type ViewKind = 'local' | 'agent' | 'project' | 'community' | 'discover' | 'market' | 'tasks' | 'updates' | 'settings';

export interface View {
  kind: ViewKind;
  agentId?: string;
  projectPath?: string;
}

export type ScopeFilter = 'all' | 'global' | 'project';
export type MarketTab = 'browse' | 'rank' | 'collections';
export type SettingsTab = 'sources' | 'ai' | 'backups' | 'oplog' | 'about';
export type SyncMode = 'sync' | 'registry';

export interface SyncModalState {
  skill: string;
  title: string;
  mode: SyncMode;
  /** 目标统一版本（未知时显示"最新版"） */
  version: string | null;
  selected: Record<string, boolean>;
}

/** 同步弹窗勾选项 key：agent + "\n" + (projectDir | "global") */
export const targetKey = (agent: string, projectDir?: string): string =>
  `${agent}\n${projectDir ?? 'global'}`;

/**
 * 共享弹窗「通用」哨兵 key：全局配置为共享目录标准（storage_location=shared）时，
 * 代表全部已检测且 sharedDirSupport 的 Agent；应用时展开为它们的 global target。
 */
export const SHARED_TARGET = '*shared*\nglobal';

/**
 * 共享模式下的默认勾选归一化：已有落点保持勾选（global 且 mode=shared 的记录折叠进「通用」），
 * 无任何落点时默认「通用 + Claude Code」。
 */
export const sharedModeSelection = (
  snap: HubSnapshot | null,
  skill: string,
): Record<string, boolean> => {
  const selected: Record<string, boolean> = {};
  if (!snap) return { [SHARED_TARGET]: true };
  let hasAny = false;
  for (const i of snap.installs) {
    if (i.skill !== skill) continue;
    hasAny = true;
    if (i.scope === 'global' && i.mode === 'shared') selected[SHARED_TARGET] = true;
    else selected[targetKey(i.agent, i.scope === 'global' ? undefined : i.scope)] = true;
  }
  if (!hasAny) {
    selected[SHARED_TARGET] = true;
    if (snap.agents.some((a) => a.id === 'claude-code' && a.detected)) {
      selected[targetKey('claude-code')] = true;
    }
  }
  return selected;
};

export const parseTargetKey = (key: string): { agent: string; projectDir?: string } => {
  const i = key.indexOf('\n');
  const agent = key.slice(0, i);
  const scope = key.slice(i + 1);
  return scope === 'global' ? { agent } : { agent, projectDir: scope };
};

export const errText = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export interface Store {
  snapshot: HubSnapshot | null;
  auth: AuthState | null;
  loggedIn: boolean;
  updates: UpdateEntry[];
  marketItems: SkillListItem[] | null;
  collections: Collection[] | null;
  /** 社区开源快照（进入本地/社区视图时后台加载；null=尚未加载） */
  community: CommunitySkill[] | null;
  communityError: string | null;

  view: View;
  setView: (v: View) => void;
  scope: ScopeFilter;
  setScope: (s: ScopeFilter) => void;
  query: string;
  setQuery: (q: string) => void;
  marketTab: MarketTab;
  setMarketTab: (t: MarketTab) => void;
  settingsTab: SettingsTab;
  setSettingsTab: (t: SettingsTab) => void;

  sync: SyncModalState | null;
  openSync: (s: SyncModalState) => void;
  closeSync: () => void;
  toggleSyncTarget: (key: string) => void;
  openRegistrySync: (skill: string) => void;

  historyFor: string | null;
  setHistoryFor: (skill: string | null) => void;
  /** 本地 Skill 详情弹窗（文件树 + 内容/编辑） */
  skillDetail: string | null;
  setSkillDetail: (skill: string | null) => void;
  /** 市场 Skill 详情弹窗 */
  marketDetail: SkillListItem | null;
  setMarketDetail: (item: SkillListItem | null) => void;
  loginOpen: boolean;
  setLoginOpen: (open: boolean) => void;

  toastMsg: string;
  toast: (msg: string) => void;
  lastScan: Date | null;
  setLastScan: (d: Date) => void;
  updaterVersion: string | null;
  restoredBackups: Record<string, boolean>;
  markBackupRestored: (id: string) => void;

  refresh: () => Promise<HubSnapshot | null>;
  refreshAuth: () => Promise<AuthState | null>;
  refreshUpdates: () => Promise<void>;
  loadMarket: () => Promise<void>;
  loadCollections: () => Promise<void>;
  /** 拉取社区开源快照（force 重新加载并显示骨架；失败静默存入 communityError） */
  loadCommunity: (force?: boolean) => Promise<void>;
  /** 执行操作并把错误转为 toast */
  run: (fn: () => Promise<void>) => void;
}

const AppContext = createContext<Store | null>(null);
export const AppProvider = AppContext.Provider;

export function useStore(): Store {
  const store = useContext(AppContext);
  if (!store) throw new Error('AppProvider missing');
  return store;
}

export function useAppStore(): Store {
  const [snapshot, setSnapshot] = useState<HubSnapshot | null>(null);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [updates, setUpdates] = useState<UpdateEntry[]>([]);
  const [marketItems, setMarketItems] = useState<SkillListItem[] | null>(null);
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [community, setCommunity] = useState<CommunitySkill[] | null>(null);
  const [communityError, setCommunityError] = useState<string | null>(null);

  const [view, setViewRaw] = useState<View>({ kind: 'local' });
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [query, setQuery] = useState('');
  const [marketTab, setMarketTab] = useState<MarketTab>('browse');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('sources');

  const [sync, setSync] = useState<SyncModalState | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [skillDetail, setSkillDetail] = useState<string | null>(null);
  const [marketDetail, setMarketDetail] = useState<SkillListItem | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [updaterVersion, setUpdaterVersion] = useState<string | null>(null);
  const [restoredBackups, setRestoredBackups] = useState<Record<string, boolean>>({});

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((msg: string): void => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2400);
  }, []);

  const snapshotRef = useRef<HubSnapshot | null>(null);
  snapshotRef.current = snapshot;
  const authRef = useRef<AuthState | null>(null);
  authRef.current = auth;
  const marketRef = useRef<SkillListItem[] | null>(null);
  marketRef.current = marketItems;

  const refresh = useCallback(async (): Promise<HubSnapshot | null> => {
    try {
      const snap = await ripple.snapshot();
      setSnapshot(snap);
      return snap;
    } catch (err) {
      toast(`加载本地数据失败：${errText(err)}`);
      return null;
    }
  }, [toast]);

  const refreshUpdates = useCallback(async (): Promise<void> => {
    try {
      setUpdates(await ripple.checkUpdates());
    } catch {
      /* 检查失败不阻塞使用 */
    }
  }, []);

  const refreshAuth = useCallback(async (): Promise<AuthState | null> => {
    try {
      const state = await ripple.authState();
      setAuth(state);
      if (state.loggedIn) void refreshUpdates();
      return state;
    } catch {
      return null;
    }
  }, [refreshUpdates]);

  const loadMarket = useCallback(async (): Promise<void> => {
    try {
      setMarketItems(await ripple.market({ sort_by: 'heat', page_size: 60 }));
    } catch (err) {
      setMarketItems([]);
      toast(`加载技能市场失败：${errText(err)}`);
    }
  }, [toast]);

  const loadCollections = useCallback(async (): Promise<void> => {
    try {
      setCollections(await ripple.collections());
    } catch (err) {
      setCollections([]);
      toast(`加载合集失败：${errText(err)}`);
    }
  }, [toast]);

  const communityBusy = useRef(false);
  const loadCommunity = useCallback(async (force = false): Promise<void> => {
    if (communityBusy.current) return;
    communityBusy.current = true;
    if (force) setCommunity(null);
    setCommunityError(null);
    try {
      setCommunity(await ripple.community());
    } catch (err) {
      // 失败静默：本地视图不打扰；社区视图读取 communityError 展示重试
      setCommunityError(errText(err));
    } finally {
      communityBusy.current = false;
    }
  }, []);

  const run = useCallback(
    (fn: () => Promise<void>): void => {
      void fn().catch((err: unknown) => toast(errText(err)));
    },
    [toast],
  );

  const setView = useCallback((v: View): void => {
    setViewRaw(v);
    setQuery('');
  }, []);

  const openSync = useCallback((s: SyncModalState): void => setSync(s), []);
  const closeSync = useCallback((): void => setSync(null), []);
  const toggleSyncTarget = useCallback((key: string): void => {
    setSync((s) => (s ? { ...s, selected: { ...s.selected, [key]: !s.selected[key] } } : s));
  }, []);

  const openRegistrySync = useCallback((skill: string): void => {
    const snap = snapshotRef.current;
    // 归一化默认勾选（已有落点保持勾选；共享落点与存储配置解耦）
    const selected: Record<string, boolean> = snap ? sharedModeSelection(snap, skill) : {};
    const item = marketRef.current?.find((m) => m.name === skill) ?? null;
    setSync({
      skill,
      title: item?.display_name ?? skill,
      mode: 'registry',
      version: item?.version ?? null,
      selected,
    });
  }, []);

  const markBackupRestored = useCallback((id: string): void => {
    setRestoredBackups((r) => ({ ...r, [id]: true }));
  }, []);

  // ---- Deep Link：ripple://install?skill=<slug> ----
  const handleDeepLink = useCallback(
    (url: string): void => {
      let skill: string | null = null;
      try {
        const u = new URL(url);
        const action = u.hostname || u.pathname.replace(/\//g, '');
        if (u.protocol === 'ripple:' && action === 'install') skill = u.searchParams.get('skill');
      } catch {
        /* 非法 URL 忽略 */
      }
      if (!skill) return;
      if (!authRef.current?.loggedIn) {
        setLoginOpen(true);
        toast(`登录后可安装「${skill}」`);
        return;
      }
      setViewRaw({ kind: 'market' });
      setMarketTab('browse');
      openRegistrySync(skill);
    },
    [openRegistrySync, toast],
  );
  const deepLinkRef = useRef(handleDeepLink);
  deepLinkRef.current = handleDeepLink;

  // ---- 启动：拉取 snapshot + authState，订阅 deep link / updater ----
  useEffect(() => {
    const offDeep = ripple.onDeepLink((url) => deepLinkRef.current(url));
    const offUpdater = ripple.onUpdaterEvent((ev) => {
      if (ev.type === 'downloaded') setUpdaterVersion(ev.version ?? '');
    });
    void (async () => {
      const [snap] = await Promise.all([refresh(), refreshAuth()]);
      // 首次启动（无任何纳管安装）：自动接管 Agent 目录中的既有技能
      if (snap && snap.installs.length === 0) {
        try {
          const { adopted } = await ripple.adoptAll();
          if (adopted > 0) {
            await refresh();
            toast(`已接管 ${adopted} 个既有技能`);
          }
        } catch {
          /* 接管失败不阻塞启动 */
        }
      }
      setLastScan(new Date());
    })();
    return () => {
      offDeep();
      offUpdater();
    };
    // 仅启动时执行一次（refresh/refreshAuth 引用稳定）
  }, [refresh, refreshAuth]);

  const loggedIn = auth?.loggedIn ?? false;

  // ---- 进入市场 / 合集时按需加载远程数据 ----
  useEffect(() => {
    if (view.kind === 'market' && loggedIn && marketItems === null) void loadMarket();
  }, [view.kind, loggedIn, marketItems, loadMarket]);
  // ---- 进入本地 / 社区 / 更新中心时后台加载社区快照（一次，失败静默）----
  useEffect(() => {
    const wants = view.kind === 'local' || view.kind === 'community' || view.kind === 'updates';
    if (wants && community === null && communityError === null) void loadCommunity();
  }, [view.kind, community, communityError, loadCommunity]);
  useEffect(() => {
    if (view.kind === 'market' && marketTab === 'collections' && loggedIn && collections === null) {
      void loadCollections();
    }
  }, [view.kind, marketTab, loggedIn, collections, loadCollections]);

  return {
    snapshot,
    auth,
    loggedIn,
    updates,
    marketItems,
    collections,
    community,
    communityError,
    view,
    setView,
    scope,
    setScope,
    query,
    setQuery,
    marketTab,
    setMarketTab,
    settingsTab,
    setSettingsTab,
    sync,
    openSync,
    closeSync,
    toggleSyncTarget,
    openRegistrySync,
    historyFor,
    setHistoryFor,
    skillDetail,
    setSkillDetail,
    marketDetail,
    setMarketDetail,
    loginOpen,
    setLoginOpen,
    toastMsg,
    toast,
    lastScan,
    setLastScan,
    updaterVersion,
    restoredBackups,
    markBackupRestored,
    refresh,
    refreshAuth,
    refreshUpdates,
    loadMarket,
    loadCollections,
    loadCommunity,
    run,
  };
}
