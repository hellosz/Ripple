import { contextBridge, ipcRenderer } from 'electron';
import {
  DEEPLINK_CHANNEL,
  DESKTOP_RPC_CHANNEL,
  UPDATER_CHANNEL,
  type DesktopApi,
} from '../shared/api.js';

const rpc = (method: string, ...args: unknown[]): Promise<unknown> =>
  ipcRenderer.invoke(DESKTOP_RPC_CHANNEL, method, args);

const rpcMethods = [
  'snapshot',
  'scan',
  'adoptAll',
  'addPlacement',
  'backupAgents',
  'applyAllToAgent',
  'removeAllFromAgent',
  'readSkillFiles',
  'community',
  'writeSkillFile',
  'sync',
  'setEnabled',
  'uninstall',
  'unifyVersions',
  'restoreBackup',
  'deleteBackup',
  'setStorageLocation',
  'setDistMode',
  'addSource',
  'removeSource',
  'listRepoSkills',
  'installFromRepo',
  'addProjectDialog',
  'removeProject',
  'importZipDialog',
  'authState',
  'login',
  'logout',
  'setServer',
  'market',
  'collections',
  'checkUpdates',
  'installFromRegistry',
  'updateAll',
  'aiGetConfig',
  'aiSetConfig',
  'aiTest',
  'aiScore',
  'aiOptimize',
  'aiApplyPatches',
  'aiScenario',
  'aiUsage',
  'logTask',
  'discoverIndex',
  'discoverRepo',
  'discoverSetPat',
  'discoverPatStatus',
  'discoverDeepSearch',
  'usageScan',
  'usageStats',
  'usageEvents',
  'usageSessions',
  'usageSettings',
  'usageClear',
  'readSkillAsset',
  'appVersion',
  'checkAppUpdate',
  'quitAndInstall',
] as const;

const api = Object.fromEntries(
  rpcMethods.map((method) => [method, (...args: unknown[]) => rpc(method, ...args)]),
) as Record<string, (...args: unknown[]) => Promise<unknown>>;

api.onDeepLink = ((cb: (url: string) => void) => {
  const listener = (_event: unknown, url: string) => cb(url);
  ipcRenderer.on(DEEPLINK_CHANNEL, listener);
  return () => ipcRenderer.removeListener(DEEPLINK_CHANNEL, listener);
}) as never;

api.onUpdaterEvent = ((
  cb: (event: { type: string; version?: string; percent?: number; message?: string }) => void,
) => {
  const listener = (
    _event: unknown,
    payload: { type: string; version?: string; percent?: number; message?: string },
  ) => cb(payload);
  ipcRenderer.on(UPDATER_CHANNEL, listener);
  return () => ipcRenderer.removeListener(UPDATER_CHANNEL, listener);
}) as never;

contextBridge.exposeInMainWorld('ripple', api as unknown as DesktopApi);
