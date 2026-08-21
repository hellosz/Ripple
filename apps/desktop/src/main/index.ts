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

const { autoUpdater } = electronUpdater;

const services = new DesktopServices();
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
  const send = (type: string, version?: string) => {
    mainWindow?.webContents.send(UPDATER_CHANNEL, { type, version });
  };
  autoUpdater.on('update-available', (info) => send('available', info.version));
  autoUpdater.on('update-downloaded', (info) => send('downloaded', info.version));
  autoUpdater.on('error', () => send('error'));
  // 检查失败不阻塞使用
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

  appVersion: () => app.getVersion(),
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
