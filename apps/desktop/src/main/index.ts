import { join } from 'node:path';
import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron';
import { readFileSync } from 'node:fs';
import electronUpdater from 'electron-updater';
import type { InstallTarget } from '@ripple/hub';
import {
  DEEPLINK_CHANNEL,
  DESKTOP_RPC_CHANNEL,
  UPDATER_CHANNEL,
} from '../shared/api.js';
import { DesktopServices } from './services.js';
import { AiService, SkillAiFeatures, analyzeScenario, type AiProvider } from './ai.js';
import { DiscoveryService } from './discovery.js';
import { existsSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { UsageCollector } from '@ripple/hub';
import type { AiPatch } from '@ripple/contract';

const { autoUpdater } = electronUpdater;

const services = new DesktopServices();
const aiService = new AiService();
const skillAi = new SkillAiFeatures(aiService);
const discovery = new DiscoveryService();
function knownSkillNames(): string[] {
  try {
    const dir = services.hub.storageDir();
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'SKILL.md')))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

// 主进程内的 collector 仅用于 stats/clear（纯 fs，安全）；scanAll 一律走子进程
const usageCollector = new UsageCollector({
  homeDir: homedir(),
  knownSkills: knownSkillNames,
  settings: () => services.hub.state.usage_collection,
});
let usageTimer: NodeJS.Timeout | null = null;

/** 扫描在 ELECTRON_RUN_AS_NODE 子进程执行（见 usage-worker.ts 头注释）；主进程只读结果 */
function scanInWorker(): Promise<Awaited<ReturnType<UsageCollector['scanAll']>>> {
  return new Promise((resolve, reject) => {
    const config = JSON.stringify({
      homeDir: homedir(),
      knownSkills: knownSkillNames(),
      settings: services.hub.state.usage_collection,
    });
    const worker = spawn(process.execPath, [join(__dirname, 'usage-worker.js'), config], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    worker.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    worker.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    const timer = setTimeout(() => {
      worker.kill();
      reject(new Error('使用扫描超时（10 分钟）'));
    }, 10 * 60 * 1000);
    worker.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    worker.on('exit', (code) => {
      clearTimeout(timer);
      const line = stdout.split('\n').find((l) => l.startsWith('RESULT:'));
      if (code === 0 && line) {
        resolve(JSON.parse(line.slice('RESULT:'.length)) as Awaited<ReturnType<UsageCollector['scanAll']>>);
      } else {
        reject(new Error(stderr.trim() || `usage-worker 退出码 ${code}`));
      }
    });
  });
}

let usageScanInFlight = false;

async function runUsageScan(trigger: string): Promise<Awaited<ReturnType<UsageCollector['scanAll']>>> {
  if (usageScanInFlight) return { added: 0, sources: [] };
  usageScanInFlight = true;
  const started = Date.now();
  let summary: Awaited<ReturnType<UsageCollector['scanAll']>>;
  try {
    summary = await scanInWorker();
  } finally {
    usageScanInFlight = false;
  }
  if (summary.added > 0 || trigger === '手动') {
    const failed = summary.sources.filter((s) => s.error).length;
    services.hub.logOp(
      '使用扫描',
      trigger,
      `新增 ${summary.added} 条 · ${summary.sources.length} 个源${failed ? ` · ${failed} 个源失败` : ''} · ${Date.now() - started}ms`,
    );
  }
  return summary;
}

/** 使用聚合摘要（仅元数据统计，不含对话正文）；无数据返回 null */
function usageSummaryOf(skill: string): string | null {
  const stats = usageCollector.stats(skill);
  if (stats.length === 0) return null;
  const lines = stats.map((s) => {
    const projects = Object.entries(s.projects)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([dir, n]) => `${dir}(${n})`)
      .join('、');
    return `- ${s.agent}: ${s.count} 次，首次 ${s.first_at.slice(0, 10)}，最近 ${s.last_at.slice(0, 10)}${projects ? `，主要项目 ${projects}` : ''}`;
  });
  return `## 本地使用统计（聚合元数据，供评估参考）\n${lines.join('\n')}`;
}

function scheduleUsageScan(): void {
  if (usageTimer) {
    clearInterval(usageTimer);
    usageTimer = null;
  }
  if (!services.hub.state.usage_collection.enabled) return;
  setTimeout(() => void runUsageScan('启动').catch(() => undefined), 10_000);
  usageTimer = setInterval(() => void runUsageScan('定时').catch(() => undefined), 30 * 60 * 1000);
}

let mainWindow: BrowserWindow | null = null;
let pendingDeepLink: string | null = null;

// ---- ripple:// 协议注册（三平台）----
if (process.defaultApp && process.argv[1]) {
  app.setAsDefaultProtocolClient('ripple', process.execPath, [join(process.cwd(), process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient('ripple');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    // Windows/Linux：deep link 通过第二实例 argv 传入
    const url = argv.find((a) => a.startsWith('ripple://'));
    if (url) deliverDeepLink(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('open-url', (event, url) => {
    // macOS
    event.preventDefault();
    deliverDeepLink(url);
  });

  void app.whenReady().then(() => {
    createWindow();
    setupUpdater();
    scheduleUsageScan();
    const url = process.argv.find((a) => a.startsWith('ripple://'));
    if (url) deliverDeepLink(url);
  });
}

function deliverDeepLink(url: string): void {
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send(DEEPLINK_CHANNEL, url);
    mainWindow.focus();
  } else {
    pendingDeepLink = url;
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: 'Ripple',
    backgroundColor: '#faf9f2',
    // 打包后 Linux 图标来自 desktop entry / mac 来自 icns；dev 模式显式指定
    ...(app.isPackaged
      ? {}
      : { icon: join(import.meta.dirname, '../../build/icons/256x256.png') }),
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingDeepLink && mainWindow) {
      mainWindow.webContents.send(DEEPLINK_CHANNEL, pendingDeepLink);
      pendingDeepLink = null;
    }
    // 冒烟模式：渲染完成即报告并退出（CI 无头验证）
    if (process.env.RIPPLE_SMOKE) {
      console.log('RIPPLE_SMOKE_OK');
      setTimeout(() => app.exit(0), 200);
    }
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    if (process.env.RIPPLE_SMOKE) {
      console.error('RIPPLE_SMOKE_RENDER_GONE', details.reason);
      app.exit(1);
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupUpdater(): void {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  const send = (type: string, version?: string, percent?: number, message?: string) => {
    mainWindow?.webContents.send(UPDATER_CHANNEL, { type, version, percent, message });
  };
  autoUpdater.on('checking-for-update', () => send('checking'));
  autoUpdater.on('update-available', (info) => send('available', info.version));
  autoUpdater.on('update-not-available', (info) => send('not-available', info.version));
  autoUpdater.on('download-progress', (progress) =>
    send('progress', undefined, Math.round(progress.percent)),
  );
  autoUpdater.on('update-downloaded', (info) => send('downloaded', info.version));
  autoUpdater.on('error', (err) => send('error', undefined, undefined, err.message));
  // 启动静默检查；失败不阻塞使用
  void autoUpdater.checkForUpdates().catch(() => {});
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---- 类型化 RPC：method 名 → 实现 ----
type RpcHandler = (...args: never[]) => unknown;

const handlers: Record<string, RpcHandler> = {
  snapshot: () => services.snapshot(),
  scan: () => services.hub.scan(),
  adoptAll: () => {
    const { adopted, skipped } = services.hub.adoptAll();
    return { adopted: adopted.length, skipped: skipped.length };
  },
  addPlacement: (skill: string, target: InstallTarget) => services.hub.addPlacement(skill, target),
  backupAgents: (agentIds: string[]) => ({ count: services.hub.backupAgents(agentIds).length }),
  applyAllToAgent: (agentId: string, skills?: string[]) => ({
    count: services.hub.applyAllToAgent(agentId, skills).length,
  }),
  removeAllFromAgent: (agentId: string) => ({ count: services.hub.removeAllFromAgent(agentId) }),
  readSkillFiles: (skill: string) => services.hub.readSkillFiles(skill),
  community: () => services.hub.communitySnapshot(),
  writeSkillFile: (skill: string, path: string, content: string) =>
    services.hub.writeSkillFile(skill, path, content),
  sync: (skill: string, targets: InstallTarget[]) => services.hub.sync(skill, targets),
  setEnabled: (skill: string, target: InstallTarget, enabled: boolean) =>
    services.hub.setEnabled(skill, target, enabled),
  uninstall: (skill: string, target?: InstallTarget) => services.hub.uninstall(skill, target),
  unifyVersions: (skill: string) => services.hub.unifyVersions(skill),
  restoreBackup: (id: string) => services.hub.restoreBackup(id),
  deleteBackup: (id: string) => services.hub.deleteBackup(id),
  setStorageLocation: (location: 'builtin' | 'shared') => services.hub.setStorageLocation(location),
  setDistMode: (mode: 'symlink' | 'copy') => services.hub.setDistMode(mode),
  addSource: (spec: string) => services.hub.addSource(spec),
  removeSource: (id: string) => services.hub.removeSource(id),
  listRepoSkills: (sourceId: string) => services.hub.listRepoSkills(sourceId),
  installFromRepo: (sourceId: string, skill: string, targets: InstallTarget[]) =>
    services.hub.installFromRepo(sourceId, skill, targets),
  removeProject: (path: string) => services.hub.removeProject(path),

  addProjectDialog: async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择项目目录',
    });
    const dir = result.filePaths[0];
    if (result.canceled || !dir) return null;
    services.hub.addProject(dir);
    // 立即接管该项目目录中的既有技能（否则要等下一次手动扫描才可见）
    services.hub.adoptAll();
    return services.hub.state.projects.find((p) => p.path === dir) ?? null;
  },

  importZipDialog: async (targets: InstallTarget[]) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Skill 包', extensions: ['zip'] }],
      title: '选择包含 SKILL.md 的 ZIP',
    });
    const file = result.filePaths[0];
    if (result.canceled || !file) return null;
    return services.hub.installFromZip(new Uint8Array(readFileSync(file)), targets);
  },

  authState: () => services.authState(),
  login: (server: string, email: string, password: string) => services.login(server, email, password),
  logout: () => services.logout(),
  setServer: (server: string) => services.setServer(server),
  market: async (query: { search?: string; sort_by?: string; page_size?: number }) => {
    const result = await services.client().skills.list({ page_size: 30, ...query } as never);
    return result.items;
  },
  collections: () => services.client().collections.list(),
  checkUpdates: () => services.checkUpdates(),
  installFromRegistry: (skill: string, targets: InstallTarget[]) =>
    services.installFromRegistry(skill, targets),
  updateAll: () => services.updateAll(),

  aiGetConfig: () => aiService.getConfig(),
  aiSetConfig: (input: { provider: AiProvider; baseUrl?: string; model?: string; apiKey?: string }) =>
    aiService.setConfig(input),
  aiTest: () => aiService.test(),
  aiScore: async (skill: string, withUsage?: boolean) => {
    const result = await skillAi.score(
      services.hub.readSkillFiles(skill),
      withUsage ? (usageSummaryOf(skill) ?? undefined) : undefined,
    );
    services.hub.logOp('AI 评分', skill, `${result.total} 分 · ${result.grade} 级${result.source === 'fallback' ? ' · 本地规则' : ''}`);
    return result;
  },
  aiOptimize: async (skill: string, withUsage?: boolean) => {
    const result = await skillAi.optimize(
      services.hub.readSkillFiles(skill),
      withUsage ? (usageSummaryOf(skill) ?? undefined) : undefined,
    );
    services.hub.logOp('AI 优化建议', skill, `${result.suggestions.length} 条建议 · ${result.patches.length} 个补丁`);
    return result;
  },
  aiScenario: async (skill: string, force?: boolean) => {
    const fingerprint = services.hub.fingerprintOf(skill);
    if (!fingerprint) throw new Error(`Skill '${skill}' not in central storage`);
    const existing = services.hub.getScenario(skill);
    if (existing && !force) {
      return { ...existing, stale: existing.fingerprint !== fingerprint };
    }
    const raw = await analyzeScenario(aiService, services.hub.readSkillFiles(skill));
    const analysis = { ...raw, fingerprint, at: new Date().toISOString() };
    services.hub.saveScenario(skill, analysis);
    return { ...analysis, stale: false };
  },
  aiUsage: () => aiService.getUsage(),
  logTask: (title: string, detail: string) => {
    services.hub.logOp('任务', title, detail);
    return { ok: true };
  },
  discoverIndex: (refresh?: boolean) => discovery.getIndex(refresh),
  discoverRepo: (owner: string, repo: string, branch?: string, pushedAt?: string | null) =>
    discovery.getRepoSkills(owner, repo, branch, pushedAt),
  discoverSetPat: (pat: string | null) => discovery.setPat(pat),
  discoverPatStatus: () => ({ configured: discovery.hasPat() }),
  discoverDeepSearch: (query?: string) => discovery.deepSearch(query),
  usageScan: () => runUsageScan('手动'),
  usageStats: (skill?: string) => usageCollector.stats(skill),
  usageEvents: (query?: { skill?: string; agent?: string; session_id?: string; limit?: number }) =>
    usageCollector.events(query),
  usageSessions: (query?: { skill?: string; agent?: string; limit?: number }) =>
    usageCollector.sessions(query),
  usageSettings: (settings?: { enabled: boolean; agents: Record<string, boolean> }) => {
    if (settings) {
      services.hub.setUsageCollection(settings);
      scheduleUsageScan();
    }
    return services.hub.state.usage_collection;
  },
  usageClear: () => {
    usageCollector.clear();
    services.hub.logOp('使用采集', '清除', '全部使用事件、游标与聚合已删除');
    return { ok: true };
  },
  readSkillAsset: (skill: string, path: string) => services.hub.readSkillAsset(skill, path),
  aiApplyPatches: (skill: string, patches: AiPatch[]) => {
    let applied = 0;
    for (const patch of patches) {
      services.hub.writeSkillFile(skill, patch.path, patch.new_content);
      applied++;
    }
    services.hub.logOp('应用优化', skill, `${applied} 个文件已落盘`);
    return { applied };
  },

  appVersion: () => app.getVersion(),
  checkAppUpdate: async () => {
    const current = app.getVersion();
    if (!app.isPackaged) {
      return { current, latest: null, available: false, message: '开发模式不检查更新' };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      const latest = result?.updateInfo?.version ?? null;
      return { current, latest, available: Boolean(latest && latest !== current) };
    } catch (err) {
      return {
        current,
        latest: null,
        available: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  },
  quitAndInstall: () => {
    autoUpdater.quitAndInstall();
  },
};

ipcMain.handle(DESKTOP_RPC_CHANNEL, async (_event, method: string, args: unknown[]) => {
  const handler = handlers[method];
  if (!handler) throw new Error(`Unknown RPC method: ${method}`);
  try {
    return await handler(...(args as never[]));
  } catch (err) {
    // 把业务错误转成可序列化消息
    throw new Error(err instanceof Error ? err.message : String(err));
  }
});
