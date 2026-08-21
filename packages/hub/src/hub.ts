import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { buildZip, extractSkillMeta, parseFrontmatter, readZipEntries } from '@ripple/skill-core';
import { AGENT_ADAPTERS, agentTargetDir, detectAgents, getAdapter } from './agents.js';
import { copyDir, distribute, ensureDir, pathExists, readDirFiles, removePath } from './fs-utils.js';
import {
  fetchRepoTarball,
  parseRepoSpec,
  payloadFromTarball,
  payloadFromZip,
  scanTarballSkills,
  type RepoSkill,
  type SkillPayload,
} from './sources.js';
import { defaultState, loadState, saveState } from './state.js';
import type {
  BackupRecord,
  DetectedAgent,
  DistMode,
  HistoryEntry,
  HubState,
  InstallRecord,
  InstallTarget,
  ScanIssue,
  SourceRepo,
  StorageLocation,
  UnmanagedSkill,
} from './types.js';

export const BACKUP_RETENTION = 20;

export interface HubOptions {
  homeDir?: string;
  platform?: NodeJS.Platform;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export class RippleHub {
  readonly homeDir: string;
  readonly platform: NodeJS.Platform;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  state: HubState;

  constructor(opts: HubOptions = {}) {
    this.homeDir = opts.homeDir ?? homedir();
    this.platform = opts.platform ?? process.platform;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? (() => new Date());
    this.state = loadState(this.rippleDir);
  }

  get rippleDir(): string {
    return join(this.homeDir, '.ripple');
  }

  get backupsDir(): string {
    return join(this.rippleDir, 'backups');
  }

  storageDir(location: StorageLocation = this.state.storage_location): string {
    return location === 'builtin'
      ? join(this.rippleDir, 'skills')
      : join(this.homeDir, '.agents', 'skills');
  }

  skillDir(name: string): string {
    return join(this.storageDir(), name);
  }

  save(): void {
    saveState(this.rippleDir, this.state);
  }

  private stamp(): string {
    return this.now().toISOString();
  }

  addHistory(skill: string, entry: Omit<HistoryEntry, 'at'>): void {
    const list = this.state.history[skill] ?? [];
    list.unshift({ ...entry, at: this.stamp() });
    this.state.history[skill] = list;
  }

  // ---- 内容 ----

  writeSkillContent(payload: SkillPayload): void {
    const dir = this.skillDir(payload.meta.name);
    removePath(dir);
    for (const [rel, data] of Object.entries(payload.files)) {
      const full = join(dir, rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, data);
    }
  }

  installedVersion(name: string): string | null {
    try {
      const md = readFileSync(join(this.skillDir(name), 'SKILL.md'), 'utf8');
      const meta = extractSkillMeta(parseFrontmatter(md));
      return meta.ok ? meta.meta.version : null;
    } catch {
      return null;
    }
  }

  // ---- 分发 ----

  private targetDirFor(target: InstallTarget, skill: string): string {
    const adapter = getAdapter(target.agent);
    if (!adapter) throw new Error(`Unknown agent: ${target.agent}`);
    return join(agentTargetDir(this.homeDir, adapter, target.projectDir), skill);
  }

  private scopeOf(target: InstallTarget): string {
    return target.projectDir ?? 'global';
  }

  private findInstall(skill: string, target: InstallTarget): InstallRecord | undefined {
    return this.state.installs.find(
      (i) => i.skill === skill && i.agent === target.agent && i.scope === this.scopeOf(target),
    );
  }

  distributeTo(skill: string, target: InstallTarget): InstallRecord {
    const src = this.skillDir(skill);
    if (!existsSync(src)) throw new Error(`Skill '${skill}' not in central storage`);
    const version = this.installedVersion(skill) ?? '0.0.0';
    const mode = distribute(src, this.targetDirFor(target, skill), this.state.dist_mode, this.platform);
    let record = this.findInstall(skill, target);
    if (record) {
      record.version = version;
      record.enabled = true;
      record.mode = mode;
    } else {
      record = {
        skill,
        version,
        agent: target.agent,
        scope: this.scopeOf(target),
        enabled: true,
        mode,
        installed_at: this.stamp(),
      };
      this.state.installs.push(record);
    }
    return record;
  }

  // ---- 安装 / 更新 / 同步 ----

  install(payload: SkillPayload, targets: InstallTarget[]): InstallRecord[] {
    const name = payload.meta.name;
    if (existsSync(this.skillDir(name))) this.createBackup(name, '更新前自动备份');
    this.writeSkillContent(payload);
    const resolved = targets.length > 0 ? targets : [{ agent: this.state.default_agent }];
    const records = resolved.map((t) => this.distributeTo(name, t));
    this.addHistory(name, {
      action: this.state.history[name]?.length ? 'update' : 'install',
      version: `v${payload.meta.version}`,
      detail: records
        .map((r) => `${r.agent}${r.scope === 'global' ? '' : ` · ${basename(r.scope)}`}`)
        .join('、'),
    });
    this.save();
    return records;
  }

  /** 同步收敛：勾选目标统一为 SSOT 当前版本，未勾选的既有目标被卸载 */
  sync(skill: string, targets: InstallTarget[]): InstallRecord[] {
    if (!existsSync(this.skillDir(skill))) throw new Error(`Skill '${skill}' not in central storage`);
    this.createBackup(skill, '同步前自动备份');
    const keep = new Set(targets.map((t) => `${t.agent}|${this.scopeOf(t)}`));
    const removed = this.state.installs.filter(
      (i) => i.skill === skill && !keep.has(`${i.agent}|${i.scope}`),
    );
    for (const record of removed) this.removeDistribution(record);
    this.state.installs = this.state.installs.filter(
      (i) => i.skill !== skill || keep.has(`${i.agent}|${i.scope}`),
    );
    const records = targets.map((t) => this.distributeTo(skill, t));
    this.addHistory(skill, {
      action: 'sync',
      version: `v${this.installedVersion(skill) ?? '?'}`,
      detail: `${targets.length} 个目标 · 已自动备份`,
    });
    this.save();
    return records;
  }

  private removeDistribution(record: InstallRecord): void {
    const target: InstallTarget = {
      agent: record.agent,
      ...(record.scope === 'global' ? {} : { projectDir: record.scope }),
    };
    removePath(this.targetDirFor(target, record.skill));
  }

  setEnabled(skill: string, target: InstallTarget, enabled: boolean): InstallRecord {
    const record = this.findInstall(skill, target);
    if (!record) throw new Error(`No install of '${skill}' at ${target.agent}/${this.scopeOf(target)}`);
    if (enabled) {
      this.distributeTo(skill, target);
      record.enabled = true;
    } else {
      this.removeDistribution(record);
      record.enabled = false;
    }
    this.save();
    return record;
  }

  uninstall(skill: string, target?: InstallTarget): void {
    const affected = this.state.installs.filter(
      (i) =>
        i.skill === skill &&
        (!target || (i.agent === target.agent && i.scope === this.scopeOf(target))),
    );
    if (affected.length === 0) throw new Error(`No install of '${skill}'`);
    this.createBackup(skill, '卸载前自动备份');
    for (const record of affected) this.removeDistribution(record);
    this.state.installs = this.state.installs.filter((i) => !affected.includes(i));
    if (!this.state.installs.some((i) => i.skill === skill)) {
      removePath(this.skillDir(skill));
    }
    this.addHistory(skill, {
      action: 'uninstall',
      version: `v${affected[0]?.version ?? '?'}`,
      detail: `${affected.length} 处安装`,
    });
    this.save();
  }

  // ---- 备份 ----

  createBackup(skill: string, reason: string): BackupRecord | null {
    const dir = this.skillDir(skill);
    if (!existsSync(dir)) return null;
    const version = this.installedVersion(skill) ?? '0.0.0';
    const files = readDirFiles(dir);
    if (Object.keys(files).length === 0) return null;
    const zip = buildZip(files);
    const ts = this.stamp().replace(/[:.]/g, '-');
    const id = `${skill}-${ts}`;
    const file = join(this.backupsDir, skill, `${ts}-v${version}.zip`);
    ensureDir(dirname(file));
    writeFileSync(file, zip);
    const record: BackupRecord = {
      id,
      skill,
      version: `v${version}`,
      reason,
      size: zip.byteLength,
      created_at: this.stamp(),
      file,
    };
    this.state.backups.unshift(record);
    // 全局保留最近 N 份（FIFO）
    while (this.state.backups.length > BACKUP_RETENTION) {
      const oldest = this.state.backups.pop();
      if (oldest) removePath(oldest.file);
    }
    this.save();
    return record;
  }

  listBackups(): BackupRecord[] {
    return [...this.state.backups];
  }

  restoreBackup(id: string): BackupRecord {
    const record = this.state.backups.find((b) => b.id === id);
    if (!record) throw new Error(`Backup '${id}' not found`);
    const data = new Uint8Array(readFileSync(record.file));
    const { entries, error } = readZipEntries(data);
    if (!entries) throw new Error(error);
    const dir = this.skillDir(record.skill);
    removePath(dir);
    for (const [rel, content] of Object.entries(entries)) {
      const full = join(dir, rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    }
    // 重建该技能全部启用中的分发
    for (const install of this.state.installs.filter((i) => i.skill === record.skill && i.enabled)) {
      this.distributeTo(record.skill, {
        agent: install.agent,
        ...(install.scope === 'global' ? {} : { projectDir: install.scope }),
      });
    }
    this.addHistory(record.skill, {
      action: 'rollback',
      version: record.version,
      detail: '从备份恢复 · 全部安装位置',
    });
    this.save();
    return record;
  }

  deleteBackup(id: string): void {
    const record = this.state.backups.find((b) => b.id === id);
    if (!record) throw new Error(`Backup '${id}' not found`);
    removePath(record.file);
    this.state.backups = this.state.backups.filter((b) => b.id !== id);
    this.save();
  }

  // ---- 设置：存储位置 / 分发方式 ----

  setStorageLocation(location: StorageLocation): void {
    if (location === this.state.storage_location) return;
    const oldLocation = this.state.storage_location;
    const oldDir = this.storageDir();
    const newDir = this.storageDir(location);
    // 只迁移 hub 纳管的技能子目录——共享目录（~/.agents/skills）不属于 hub 独占，
    // 其中其他工具（如 lark-cli）放置的内容绝不能被搬动或删除。
    const managed = new Set(this.state.installs.map((i) => i.skill));
    for (const skill of managed) {
      const src = join(oldDir, skill);
      if (existsSync(src)) copyDir(src, join(newDir, skill));
    }
    this.state.storage_location = location;
    // 重建全部启用分发（指向新位置）
    for (const install of this.state.installs.filter((i) => i.enabled)) {
      this.distributeTo(install.skill, {
        agent: install.agent,
        ...(install.scope === 'global' ? {} : { projectDir: install.scope }),
      });
    }
    // 清理旧位置：仅 hub 独占的内置目录（~/.ripple/skills）可整体删除；
    // 共享目录一律保留（多余副本无害，误删有害）。
    if (oldLocation === 'builtin' && existsSync(oldDir) && oldDir !== newDir) {
      removePath(oldDir);
    }
    this.save();
  }

  setDistMode(mode: DistMode): void {
    this.state.dist_mode = mode;
    for (const install of this.state.installs.filter((i) => i.enabled)) {
      this.distributeTo(install.skill, {
        agent: install.agent,
        ...(install.scope === 'global' ? {} : { projectDir: install.scope }),
      });
    }
    this.save();
  }

  // ---- 项目 / Agent / 扫描 ----

  addProject(path: string): void {
    if (this.state.projects.some((p) => p.path === path)) return;
    this.state.projects.push({ path, name: basename(path), added_at: this.stamp() });
    this.save();
  }

  removeProject(path: string): void {
    this.state.projects = this.state.projects.filter((p) => p.path !== path);
    this.save();
  }

  detectAgents(): DetectedAgent[] {
    return detectAgents(this.homeDir);
  }

  /** 扫描：unmanaged 技能、版本冲突、丢失分发 */
  scan(): ScanIssue[] {
    const issues: ScanIssue[] = [];
    const managed = new Set(this.state.installs.map((i) => `${i.skill}|${i.agent}|${i.scope}`));
    const scanDir = (dir: string, agent: string, scope: string): void => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        const key = `${entry.name}|${agent}|${scope}`;
        if (!managed.has(key)) {
          issues.push({
            kind: 'unmanaged',
            skill: entry.name,
            detail: `${agent} · ${scope === 'global' ? '全局' : basename(scope)} · ${join(dir, entry.name)}`,
          });
        }
      }
    };
    for (const adapter of AGENT_ADAPTERS) {
      scanDir(join(this.homeDir, adapter.globalRelPath), adapter.id, 'global');
      for (const project of this.state.projects) {
        scanDir(join(project.path, adapter.projectRelPath), adapter.id, project.path);
      }
    }
    for (const install of this.state.installs) {
      if (!install.enabled) continue;
      const target: InstallTarget = {
        agent: install.agent,
        ...(install.scope === 'global' ? {} : { projectDir: install.scope }),
      };
      if (!pathExists(this.targetDirFor(target, install.skill))) {
        issues.push({
          kind: 'missing',
          skill: install.skill,
          detail: `${install.agent} 分发丢失，可重新启用`,
        });
      }
    }
    for (const [skill, versions] of this.conflicts()) {
      issues.push({ kind: 'version-conflict', skill, detail: versions.join(' / ') });
    }
    return issues;
  }

  /** 列出各 Agent/项目目录中未被 hub 纳管的既有技能 */
  listUnmanaged(): UnmanagedSkill[] {
    const managed = new Set(this.state.installs.map((i) => `${i.skill}|${i.agent}|${i.scope}`));
    const found: UnmanagedSkill[] = [];
    const scanDir = (dir: string, agent: string, scope: string): void => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        if (managed.has(`${entry.name}|${agent}|${scope}`)) continue;
        const path = join(dir, entry.name);
        let version: string | null = null;
        let hasSkillMd = false;
        try {
          const md = readFileSync(join(path, 'SKILL.md'), 'utf8');
          hasSkillMd = true;
          const meta = extractSkillMeta(parseFrontmatter(md));
          version = meta.ok ? meta.meta.version : null;
        } catch {
          /* 无 SKILL.md：不可接管 */
        }
        found.push({ skill: entry.name, agent, scope, path, version, hasSkillMd });
      }
    };
    for (const adapter of AGENT_ADAPTERS) {
      scanDir(join(this.homeDir, adapter.globalRelPath), adapter.id, 'global');
      for (const project of this.state.projects) {
        scanDir(join(project.path, adapter.projectRelPath), adapter.id, project.path);
      }
    }
    return found;
  }

  /**
   * 接管既有技能：内容进入 SSOT（已存在则保留 SSOT 版本），
   * 原目录保持原样（mode=copy），纳入安装记录后即可同步/备份/回退。
   */
  adoptAll(): { adopted: InstallRecord[]; skipped: UnmanagedSkill[] } {
    const adopted: InstallRecord[] = [];
    const skipped: UnmanagedSkill[] = [];
    for (const entry of this.listUnmanaged()) {
      if (!entry.hasSkillMd) {
        skipped.push(entry);
        continue;
      }
      const ssotDir = this.skillDir(entry.skill);
      if (!existsSync(ssotDir)) copyDir(entry.path, ssotDir);
      const record: InstallRecord = {
        skill: entry.skill,
        version: entry.version ?? this.installedVersion(entry.skill) ?? '1.0.0',
        agent: entry.agent,
        scope: entry.scope,
        enabled: true,
        mode: 'copy',
        installed_at: this.stamp(),
      };
      this.state.installs.push(record);
      adopted.push(record);
      this.addHistory(entry.skill, {
        action: 'install',
        version: `v${record.version}`,
        detail: `接管既有安装 · ${entry.agent}${entry.scope === 'global' ? '' : ` · ${basename(entry.scope)}`}`,
      });
    }
    if (adopted.length > 0) this.save();
    return { adopted, skipped };
  }

  /** 同一技能多处安装版本不一致 */
  conflicts(): Map<string, string[]> {
    const bySkill = new Map<string, Set<string>>();
    for (const install of this.state.installs) {
      const set = bySkill.get(install.skill) ?? new Set();
      set.add(install.version);
      bySkill.set(install.skill, set);
    }
    const result = new Map<string, string[]>();
    for (const [skill, versions] of bySkill) {
      if (versions.size > 1) result.set(skill, [...versions].sort());
    }
    return result;
  }

  /** 版本统一：全部安装位置分发为 SSOT 当前内容 */
  unifyVersions(skill: string): void {
    this.createBackup(skill, '同步前自动备份');
    for (const install of this.state.installs.filter((i) => i.skill === skill)) {
      this.distributeTo(skill, {
        agent: install.agent,
        ...(install.scope === 'global' ? {} : { projectDir: install.scope }),
      });
    }
    this.save();
  }

  // ---- 来源 ----

  listSources(): SourceRepo[] {
    return [...this.state.sources];
  }

  addSource(spec: string, note = '自定义仓库'): SourceRepo {
    const parsed = parseRepoSpec(spec);
    const id = `${parsed.owner}/${parsed.repo}`;
    if (this.state.sources.some((s) => s.id === id)) throw new Error(`Source '${id}' already exists`);
    const source: SourceRepo = { id, ...parsed, note, builtin: false };
    this.state.sources.push(source);
    this.save();
    return source;
  }

  removeSource(id: string): void {
    const source = this.state.sources.find((s) => s.id === id);
    if (!source) throw new Error(`Source '${id}' not found`);
    if (source.builtin) throw new Error('Builtin source cannot be removed');
    this.state.sources = this.state.sources.filter((s) => s.id !== id);
    this.save();
  }

  async listRepoSkills(sourceId: string): Promise<RepoSkill[]> {
    const source = this.state.sources.find((s) => s.id === sourceId);
    if (!source) throw new Error(`Source '${sourceId}' not found`);
    const tarball = await fetchRepoTarball(source, this.fetchImpl);
    return scanTarballSkills(tarball, source.subdir).skills;
  }

  async installFromRepo(
    sourceId: string,
    skillName: string,
    targets: InstallTarget[],
  ): Promise<InstallRecord[]> {
    const source = this.state.sources.find((s) => s.id === sourceId);
    if (!source) throw new Error(`Source '${sourceId}' not found`);
    const tarball = await fetchRepoTarball(source, this.fetchImpl);
    const payload = payloadFromTarball(tarball, skillName, source.subdir);
    return this.install(payload, targets);
  }

  installFromZip(data: Uint8Array, targets: InstallTarget[]): InstallRecord[] {
    return this.install(payloadFromZip(data), targets);
  }
}

export { defaultState };
