import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app, safeStorage } from 'electron';
import { RippleClient } from '@ripple/api-client';
import { RippleHub, readDirFiles, type InstallTarget } from '@ripple/hub';
import { payloadFromZip } from '@ripple/hub';
import type { AuthState, HubSnapshot, UpdateEntry } from '../shared/api.js';

const DEFAULT_SERVER = 'http://localhost:8000';

interface AuthFile {
  server: string;
  /** safeStorage 加密后的 base64；不可用时明文（degraded 标记） */
  token?: string;
  encrypted?: boolean;
}

export class DesktopServices {
  readonly hub = new RippleHub();
  private authFile: string;
  private auth: AuthFile = { server: DEFAULT_SERVER };
  private user: AuthState['user'] = null;

  constructor() {
    this.authFile = join(app.getPath('userData'), 'auth.json');
    try {
      this.auth = JSON.parse(readFileSync(this.authFile, 'utf8')) as AuthFile;
    } catch {
      /* 首次启动 */
    }
  }

  private saveAuth(): void {
    mkdirSync(dirname(this.authFile), { recursive: true });
    writeFileSync(this.authFile, JSON.stringify(this.auth), { mode: 0o600 });
  }

  private get token(): string | null {
    if (!this.auth.token) return null;
    if (this.auth.encrypted) {
      try {
        return safeStorage.decryptString(Buffer.from(this.auth.token, 'base64'));
      } catch {
        return null;
      }
    }
    return this.auth.token;
  }

  private setToken(token: string | null): void {
    if (!token) {
      delete this.auth.token;
      delete this.auth.encrypted;
    } else if (safeStorage.isEncryptionAvailable()) {
      this.auth.token = safeStorage.encryptString(token).toString('base64');
      this.auth.encrypted = true;
    } else {
      this.auth.token = token;
      this.auth.encrypted = false;
    }
    this.saveAuth();
  }

  client(): RippleClient {
    return new RippleClient({
      baseUrl: this.auth.server || DEFAULT_SERVER,
      getToken: () => this.token,
    });
  }

  async authState(): Promise<AuthState> {
    if (this.token && !this.user) {
      try {
        this.user = await this.client().auth.me();
      } catch {
        this.user = null;
      }
    }
    return {
      server: this.auth.server || DEFAULT_SERVER,
      loggedIn: Boolean(this.token && this.user),
      user: this.user,
    };
  }

  async login(server: string, email: string, password: string): Promise<AuthState> {
    this.auth.server = server.replace(/\/$/, '') || DEFAULT_SERVER;
    this.saveAuth();
    const result = await this.client().auth.login(email, password);
    this.setToken(result.access_token);
    this.user = result.user;
    return this.authState();
  }

  async logout(): Promise<AuthState> {
    this.setToken(null);
    this.user = null;
    return this.authState();
  }

  async setServer(server: string): Promise<AuthState> {
    this.auth.server = server.replace(/\/$/, '') || DEFAULT_SERVER;
    this.saveAuth();
    return this.authState();
  }

  snapshot(): HubSnapshot {
    const hub = this.hub;
    const agents = hub.detectAgents().map((a) => ({
      ...a,
      installCount: hub.state.installs.filter((i) => i.agent === a.id).length,
    }));
    const skills: HubSnapshot['skills'] = {};
    // 纳管安装 ∪ SSOT（共享库中未纳管的技能对支持共享标准的 Agent 同样可用）
    const skillNames = new Set(hub.state.installs.map((i) => i.skill));
    try {
      const storageDir = hub.storageDir();
      if (existsSync(storageDir)) {
        for (const entry of readdirSync(storageDir, { withFileTypes: true })) {
          if (entry.isDirectory() && existsSync(join(storageDir, entry.name, 'SKILL.md'))) {
            skillNames.add(entry.name);
          }
        }
      }
    } catch {
      /* 存储目录不可读时仅展示纳管安装 */
    }
    for (const name of skillNames) {
      let description: string | null = null;
      try {
        const files = readDirFiles(hub.skillDir(name));
        const md = files['SKILL.md'];
        if (md) {
          const text = new TextDecoder().decode(md);
          const match = /description:\s*(.+)/.exec(text);
          description = match?.[1]?.trim() ?? null;
        }
      } catch {
        /* SSOT 缺失 */
      }
      skills[name] = { version: hub.installedVersion(name), description };
    }
    return {
      installs: hub.state.installs,
      projects: hub.state.projects,
      sources: hub.state.sources,
      backups: hub.state.backups,
      history: hub.state.history,
      agents,
      conflicts: Object.fromEntries(hub.conflicts()),
      settings: {
        storage_location: hub.state.storage_location,
        dist_mode: hub.state.dist_mode,
        default_agent: hub.state.default_agent,
        storage_dir: hub.storageDir(),
        backups_dir: hub.backupsDir,
      },
      skills,
      oplog: hub.state.oplog,
      scenarios: hub.state.scenarios,
    };
  }

  async installFromRegistry(skill: string, targets: InstallTarget[]) {
    const data = await this.client().skills.download(skill);
    return this.hub.install(payloadFromZip(new Uint8Array(data)), targets, { origin: 'registry' });
  }

  async checkUpdates(): Promise<UpdateEntry[]> {
    const client = this.client();
    const entries: UpdateEntry[] = [];
    for (const skill of new Set(this.hub.state.installs.map((i) => i.skill))) {
      try {
        const detail = await client.skills.get(skill);
        const current = this.hub.installedVersion(skill);
        const outdated = this.hub.state.installs.filter(
          (i) => i.skill === skill && i.version !== detail.version,
        );
        if ((current && current !== detail.version) || outdated.length > 0) {
          entries.push({
            skill,
            current,
            latest: detail.version,
            targets: this.hub.state.installs.filter((i) => i.skill === skill).length,
          });
        }
      } catch {
        /* 远端不存在的本地技能跳过 */
      }
    }
    return entries;
  }

  async updateAll(): Promise<UpdateEntry[]> {
    const updates = await this.checkUpdates();
    for (const entry of updates) {
      const targets: InstallTarget[] = this.hub.state.installs
        .filter((i) => i.skill === entry.skill)
        .map((i) => ({ agent: i.agent, ...(i.scope === 'global' ? {} : { projectDir: i.scope }) }));
      await this.installFromRegistry(entry.skill, targets);
    }
    return updates;
  }
}
