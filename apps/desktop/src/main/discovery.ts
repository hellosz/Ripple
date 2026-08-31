import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { app, safeStorage } from 'electron';
import { SkillDiscovery, type DiscoverIndex, type DiscoverRepo, type DiscoverRepoSkills } from '@ripple/hub';

interface PatFile {
  /** safeStorage 加密后的 base64；不可用时明文（degraded 标记） */
  pat?: string;
  encrypted?: boolean;
}

/** 发现层桌面封装：SkillDiscovery + PAT 的 safeStorage 存储 */
export class DiscoveryService {
  private discovery: SkillDiscovery;
  private patFile: string;
  private patData: PatFile = {};

  constructor() {
    this.discovery = new SkillDiscovery({ baseDir: join(homedir(), '.ripple', 'discover') });
    this.patFile = join(app.getPath('userData'), 'discover-pat.json');
    try {
      this.patData = JSON.parse(readFileSync(this.patFile, 'utf8')) as PatFile;
    } catch {
      /* 未配置 */
    }
  }

  private readPat(): string | null {
    if (!this.patData.pat) return null;
    if (this.patData.encrypted) {
      try {
        return safeStorage.decryptString(Buffer.from(this.patData.pat, 'base64'));
      } catch {
        return null;
      }
    }
    return this.patData.pat;
  }

  hasPat(): boolean {
    return this.readPat() !== null;
  }

  setPat(pat: string | null): { configured: boolean } {
    if (!pat) {
      this.patData = {};
      try {
        rmSync(this.patFile, { force: true });
      } catch {
        /* 忽略 */
      }
      return { configured: false };
    }
    if (safeStorage.isEncryptionAvailable()) {
      this.patData = { pat: safeStorage.encryptString(pat).toString('base64'), encrypted: true };
    } else {
      this.patData = { pat, encrypted: false };
    }
    mkdirSync(dirname(this.patFile), { recursive: true });
    writeFileSync(this.patFile, JSON.stringify(this.patData), { mode: 0o600 });
    return { configured: true };
  }

  getIndex(refresh?: boolean): Promise<DiscoverIndex> {
    return this.discovery.getIndex(refresh ?? false);
  }

  getRepoSkills(
    owner: string,
    repo: string,
    branch?: string,
    pushedAt?: string | null,
  ): Promise<DiscoverRepoSkills> {
    return this.discovery.getRepoSkills({
      owner,
      repo,
      ...(branch ? { branch } : {}),
      ...(pushedAt !== undefined ? { pushed_at: pushedAt } : {}),
    });
  }

  deepSearch(query?: string): Promise<DiscoverRepo[]> {
    const pat = this.readPat();
    if (!pat) throw new Error('需先在设置中配置 GitHub PAT');
    return this.discovery.deepSearch(pat, query);
  }
}
