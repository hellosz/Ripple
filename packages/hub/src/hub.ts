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
import { treeHashFromDir } from './fingerprint.js';
import type { ScenarioAnalysis } from './types.js';
import { defaultState, loadState, saveState } from './state.js';
import type {
  BackupRecord,
  CommunitySkill,
  DetectedAgent,
  DistMode,
  EffectiveMode,
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

  /** 全局操作日志（倒序，上限 500 条） */
  logOp(action: string, target: string, detail: string): void {
    this.state.oplog.unshift({ at: this.stamp(), action, target, detail });
    if (this.state.oplog.length > 500) this.state.oplog.length = 500;
  }

  addHistory(skill: string, entry: Omit<HistoryEntry, 'at'>): void {
    const list = this.state.history[skill] ?? [];
    list.unshift({ ...entry, at: this.stamp() });
    this.state.history[skill] = list;
  }

  // ---- 内容 ----

  writeSkillContent(payload: SkillPayload): void {
    const dir = this.skillDir(payload.meta.name);
    this.state.owned[payload.meta.name] = true;
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

  private siblingOrigin(skill: string): string | undefined {
    return this.state.installs.find((i) => i.skill === skill && i.origin)?.origin;
  }

  distributeTo(skill: string, target: InstallTarget, origin?: string): InstallRecord {
    const src = this.skillDir(skill);
    if (!existsSync(src)) throw new Error(`Skill '${skill}' not in central storage`);
    const version = this.installedVersion(skill) ?? '0.0.0';
    const adapter = getAdapter(target.agent);
    if (!adapter) throw new Error(`Unknown agent: ${target.agent}`);
    // 共享目录标准：存储位于 ~/.agents/skills 且 Agent 原生支持时零分发（除非显式 dedicated 个性化）
    let mode: EffectiveMode;
    if (
      !target.dedicated &&
      adapter.sharedDirSupport &&
      this.state.storage_location === 'shared' &&
      !target.projectDir
    ) {
      // 清理此前的专属分发（仅 hub 创建的链接，copy 形态可能是用户原有内容不动）
      const prev = this.findInstall(skill, target);
      if (prev && (prev.mode === 'symlink' || prev.mode === 'junction')) {
        removePath(this.targetDirFor(target, skill));
      }
      mode = 'shared';
    } else {
      mode = distribute(src, this.targetDirFor(target, skill), this.state.dist_mode, this.platform);
    }
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
        origin: origin ?? this.siblingOrigin(skill) ?? 'local',
      };
      this.state.installs.push(record);
    }
    return record;
  }

  // ---- 安装 / 更新 / 同步 ----

  install(
    payload: SkillPayload,
    targets: InstallTarget[],
    opts: { origin?: string } = {},
  ): InstallRecord[] {
    const name = payload.meta.name;
    if (existsSync(this.skillDir(name))) this.createBackup(name, '更新前自动备份');
    this.writeSkillContent(payload);
    const resolved = targets.length > 0 ? targets : [{ agent: this.state.default_agent }];
    const records = resolved.map((t) => this.distributeTo(name, t, opts.origin));
    const detail = records
      .map((r) => `${r.agent}${r.scope === 'global' ? '' : ` · ${basename(r.scope)}`}`)
      .join('、');
    this.addHistory(name, {
      action: this.state.history[name]?.length ? 'update' : 'install',
      version: `v${payload.meta.version}`,
      detail,
    });
    this.logOp('安装', name, `v${payload.meta.version} → ${detail}`);
    this.save();
    return records;
  }

  /** Agent 粒度补齐：把 SSOT 已有技能补装到指定目标（不改内容，无需备份） */
  addPlacement(skill: string, target: InstallTarget): InstallRecord {
    const record = this.distributeTo(skill, target);
    this.addHistory(skill, {
      action: 'install',
      version: `v${record.version}`,
      detail: `补齐到 ${target.agent}${target.projectDir ? ` · ${basename(target.projectDir)}` : ''}${record.mode === 'shared' ? '（通用）' : '（专属）'}`,
    });
    this.logOp('补齐', skill, `${target.agent} · ${record.mode === 'shared' ? '通用' : `专属(${record.mode})`}`);
    this.save();
    return record;
  }

  /** 按 Agent 批量备份：对指定 Agent 集合安装的全部技能（去重）逐一快照 */
  backupAgents(agentIds: string[]): BackupRecord[] {
    const skills = new Set<string>();
    for (const install of this.state.installs) {
      if (agentIds.includes(install.agent)) skills.add(install.skill);
    }
    // 支持共享标准的 Agent：共享存储中的全部技能视同已安装
    if (this.state.storage_location === 'shared') {
      const sharedAgents = agentIds.filter((id) => getAdapter(id)?.sharedDirSupport);
      if (sharedAgents.length > 0 && existsSync(this.storageDir())) {
        for (const entry of readdirSync(this.storageDir(), { withFileTypes: true })) {
          if (entry.isDirectory() && existsSync(join(this.storageDir(), entry.name, 'SKILL.md'))) {
            skills.add(entry.name);
          }
        }
      }
    }
    const records: BackupRecord[] = [];
    for (const skill of skills) {
      const record = this.createBackup(skill, `手动备份 · ${agentIds.join('、')}`);
      if (record) records.push(record);
    }
    this.logOp('批量备份', agentIds.join('、'), `${records.length} 个技能已快照`);
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
    this.logOp('同步', skill, `${targets.length} 个目标（移除 ${removed.length} 处）`);
    this.save();
    return records;
  }

  private removeDistribution(record: InstallRecord): void {
    if (record.mode === 'shared') return; // 共享标准引入：无专属落盘可移除
    const target: InstallTarget = {
      agent: record.agent,
      ...(record.scope === 'global' ? {} : { projectDir: record.scope }),
    };
    removePath(this.targetDirFor(target, record.skill));
  }

  setEnabled(skill: string, target: InstallTarget, enabled: boolean): InstallRecord {
    const record = this.findInstall(skill, target);
    if (!record) throw new Error(`No install of '${skill}' at ${target.agent}/${this.scopeOf(target)}`);
    if (record.mode === 'shared') {
      throw new Error('通用（共享标准）引入的安装无需启停；如需独立控制请改为专属安装');
    }
    if (enabled) {
      this.distributeTo(skill, target);
      record.enabled = true;
    } else {
      this.removeDistribution(record);
      record.enabled = false;
    }
    this.logOp(enabled ? '启用' : '禁用', skill, `${target.agent}${target.projectDir ? ` · ${basename(target.projectDir)}` : ''}`);
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
    // 最后一处卸载：仅删除 hub 自己写入的 SSOT 内容（共享目录中他人内容不动）
    if (!this.state.installs.some((i) => i.skill === skill)) {
      delete this.state.scenarios[skill];
      if (this.state.owned[skill]) {
        removePath(this.skillDir(skill));
        delete this.state.owned[skill];
      }
    }
    this.addHistory(skill, {
      action: 'uninstall',
      version: `v${affected[0]?.version ?? '?'}`,
      detail: `${affected.length} 处安装`,
    });
    this.logOp('卸载', skill, `${affected.length} 处安装 · 备份已保留`);
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
    this.logOp('回退', record.skill, `${record.version} · 从备份恢复`);
    this.save();
    return record;
  }

  deleteBackup(id: string): void {
    const record = this.state.backups.find((b) => b.id === id);
    if (!record) throw new Error(`Backup '${id}' not found`);
    removePath(record.file);
    this.state.backups = this.state.backups.filter((b) => b.id !== id);
    this.logOp('删除备份', record.skill, `${record.version} · ${record.reason}`);
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
    this.logOp('存储位置', location === 'shared' ? '~/.agents/skills' : '~/.ripple/skills', `${managed.size} 个纳管技能已迁移`);
    this.save();
  }

  setDistMode(mode: DistMode): void {
    this.state.dist_mode = mode;
    this.logOp('分发方式', mode, '全部启用分发已重建');
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
    this.logOp('添加项目', basename(path), path);
    this.save();
  }

  removeProject(path: string): void {
    const removed = this.state.installs.filter((i) => i.scope === path);
    for (const record of removed) this.removeDistribution(record);
    this.state.installs = this.state.installs.filter((i) => i.scope !== path);
    this.state.projects = this.state.projects.filter((p) => p.path !== path);
    this.logOp('移除项目', basename(path), `${removed.length} 个作用域安装记录已清理（项目文件保留）`);
    this.save();
  }

  /** SSOT 中全部技能名（含未纳管但位于共享库中的） */
  listStoredSkills(): string[] {
    const names = new Set(this.state.installs.map((i) => i.skill));
    const dir = this.storageDir();
    if (existsSync(dir)) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && existsSync(join(dir, entry.name, 'SKILL.md'))) names.add(entry.name);
      }
    }
    return [...names].sort();
  }

  /** 批量：把技能集合（缺省为全部）补齐到某 Agent（内容不变，免逐技能备份） */
  applyAllToAgent(agentId: string, skills?: string[]): InstallRecord[] {
    const names = skills ?? this.listStoredSkills();
    const records: InstallRecord[] = [];
    for (const name of names) {
      if (this.findInstall(name, { agent: agentId })) continue;
      if (!existsSync(this.skillDir(name))) continue;
      records.push(this.distributeTo(name, { agent: agentId }));
    }
    this.logOp('批量复制', agentId, `${records.length} 个技能已补齐`);
    this.save();
    return records;
  }

  /** 批量：移除某 Agent 的全部全局 placement（SSOT 保留，免逐技能备份） */
  removeAllFromAgent(agentId: string): number {
    const affected = this.state.installs.filter((i) => i.agent === agentId && i.scope === 'global');
    for (const record of affected) this.removeDistribution(record);
    this.state.installs = this.state.installs.filter(
      (i) => !(i.agent === agentId && i.scope === 'global'),
    );
    this.logOp('批量取消复制', agentId, `${affected.length} 个技能的 placement 已移除（内容保留）`);
    this.save();
    return affected.length;
  }

  // ---- 场景分析持久化 ----

  fingerprintOf(skill: string): string | null {
    const dir = this.skillDir(skill);
    return existsSync(dir) ? treeHashFromDir(dir) : null;
  }

  getScenario(skill: string): ScenarioAnalysis | null {
    return this.state.scenarios[skill] ?? null;
  }

  setUsageCollection(settings: { enabled: boolean; agents: Record<string, boolean> }): void {
    this.state.usage_collection = settings;
    this.logOp('使用采集', settings.enabled ? '开启' : '关闭', Object.entries(settings.agents).filter(([, v]) => v === false).map(([k]) => `${k} 已单独禁用`).join('、') || '全部 Agent 跟随总开关');
    this.save();
  }

  saveScenario(skill: string, analysis: ScenarioAnalysis): void {
    this.state.scenarios[skill] = analysis;
    this.logOp('场景分析', skill, analysis.summary.slice(0, 40));
    this.save();
  }

  // ---- 素材预览 ----

  /** 读取单个素材文件（含二进制），供预览；5MB 上限 */
  readSkillAsset(
    skill: string,
    relPath: string,
  ): { base64: string; mime: string; size: number } {
    if (relPath.startsWith('/') || relPath.split('/').includes('..')) {
      throw new Error(`Unsafe path: ${relPath}`);
    }
    const full = join(this.skillDir(skill), relPath);
    if (!existsSync(full)) throw new Error(`File not found: ${relPath}`);
    const data = readFileSync(full);
    if (data.byteLength > 5 * 1024 * 1024) throw new Error('文件超过 5MB 预览上限');
    const ext = relPath.slice(relPath.lastIndexOf('.') + 1).toLowerCase();
    const MIME: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
      webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', ico: 'image/x-icon',
      pdf: 'application/pdf', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf',
    };
    return {
      base64: data.toString('base64'),
      mime: MIME[ext] ?? 'application/octet-stream',
      size: data.byteLength,
    };
  }

  // ---- 编辑器后端 ----

  /** 读取技能全部文本文件（跳过二进制与超限文件） */
  readSkillFiles(skill: string): Array<{ path: string; content: string; size: number; binary?: boolean }> {
    const dir = this.skillDir(skill);
    if (!existsSync(dir)) throw new Error(`Skill '${skill}' not in central storage`);
    const files = readDirFiles(dir);
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const out: Array<{ path: string; content: string; size: number; binary?: boolean }> = [];
    for (const [rel, data] of Object.entries(files)) {
      if (data.byteLength <= 512 * 1024) {
        try {
          out.push({ path: rel, content: decoder.decode(data), size: data.byteLength });
          continue;
        } catch {
          /* 非 UTF-8 → 按二进制列出 */
        }
      }
      // 二进制/超限文件仅列出条目（内容经 readSkillAsset 按需读取预览）
      out.push({ path: rel, content: '', size: data.byteLength, binary: true });
    }
    return out.sort((a, b) => (a.path === 'SKILL.md' ? -1 : b.path === 'SKILL.md' ? 1 : a.path.localeCompare(b.path)));
  }

  /** 写回单个文件到 SSOT 并重建 copy/junction 型分发 */
  writeSkillFile(skill: string, relPath: string, content: string): void {
    if (relPath.startsWith('/') || relPath.split('/').includes('..')) {
      throw new Error(`Unsafe path: ${relPath}`);
    }
    const dir = this.skillDir(skill);
    if (!existsSync(dir)) throw new Error(`Skill '${skill}' not in central storage`);
    const full = join(dir, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
    // symlink 分发自动可见；copy/junction 分发需要重建
    for (const install of this.state.installs.filter(
      (i) => i.skill === skill && i.enabled && (i.mode === 'copy' || i.mode === 'junction'),
    )) {
      this.distributeTo(skill, {
        agent: install.agent,
        ...(install.scope === 'global' ? {} : { projectDir: install.scope }),
      });
    }
    this.logOp('编辑', skill, relPath);
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
        origin: 'adopt',
      };
      this.state.installs.push(record);
      adopted.push(record);
      this.addHistory(entry.skill, {
        action: 'install',
        version: `v${record.version}`,
        detail: `接管既有安装 · ${entry.agent}${entry.scope === 'global' ? '' : ` · ${basename(entry.scope)}`}`,
      });
    }
    if (adopted.length > 0) {
      this.logOp('接管', `${adopted.length} 个既有技能`, adopted.map((a) => a.skill).slice(0, 8).join('、') + (adopted.length > 8 ? '…' : ''));
      this.save();
    }
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
    const id = parsed.provider === 'gitlab' ? `${parsed.host}/${parsed.owner}/${parsed.repo}` : `${parsed.owner}/${parsed.repo}`;
    if (this.state.sources.some((s) => s.id === id)) throw new Error(`Source '${id}' already exists`);
    const source: SourceRepo = { id, ...parsed, note, builtin: false };
    this.state.sources.push(source);
    this.logOp('添加来源', id, parsed.provider === 'gitlab' ? `GitLab · ${parsed.host}` : 'GitHub');
    this.save();
    return source;
  }

  removeSource(id: string): void {
    const source = this.state.sources.find((s) => s.id === id);
    if (!source) throw new Error(`Source '${id}' not found`);
    this.state.sources = this.state.sources.filter((s) => s.id !== id);
    this.logOp('移除来源', id, source.builtin ? '内置仓库（可重新添加恢复）· 已装技能保留' : '已装技能保留');
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
    return this.install(payload, targets, { origin: `repo:${sourceId}` });
  }

  installFromZip(data: Uint8Array, targets: InstallTarget[]): InstallRecord[] {
    return this.install(payloadFromZip(data), targets, { origin: 'zip' });
  }

  // ---- 社区开源 ----

  /** 单技能子路径的最近提交时间（GitHub/GitLab commits API，best-effort） */
  private async fetchCommitTime(source: SourceRepo, repoPath: string): Promise<string | null> {
    try {
      if (source.provider === 'gitlab' && source.host) {
        const project = encodeURIComponent(`${source.owner}/${source.repo}`);
        const url = `https://${source.host}/api/v4/projects/${project}/repository/commits?ref_name=${encodeURIComponent(source.branch)}&path=${encodeURIComponent(repoPath)}&per_page=1`;
        const res = await this.fetchImpl(url);
        if (!res.ok) return null;
        const data = (await res.json()) as Array<{ committed_date?: string }>;
        return data[0]?.committed_date ?? null;
      }
      const url = `https://api.github.com/repos/${source.owner}/${source.repo}/commits?sha=${encodeURIComponent(source.branch)}&path=${encodeURIComponent(repoPath)}&per_page=1`;
      const res = await this.fetchImpl(url);
      if (!res.ok) return null;
      const data = (await res.json()) as Array<{ commit?: { committer?: { date?: string } } }>;
      return data[0]?.commit?.committer?.date ?? null;
    } catch {
      return null;
    }
  }

  /**
   * 社区开源快照：逐来源列出技能并与本地指纹比对。
   * 提交时间仅对「本地存在」的技能获取（控制 API 配额）；来源不可达时整组跳过。
   */
  async communitySnapshot(): Promise<CommunitySkill[]> {
    const out: CommunitySkill[] = [];
    for (const source of this.state.sources) {
      let skills: RepoSkill[];
      try {
        const tarball = await fetchRepoTarball(source, this.fetchImpl);
        skills = scanTarballSkills(tarball, source.subdir).skills;
      } catch {
        continue;
      }
      for (const skill of skills) {
        const dir = this.skillDir(skill.name);
        const localFingerprint = existsSync(dir) ? treeHashFromDir(dir) : null;
        const installed =
          localFingerprint !== null || this.state.installs.some((i) => i.skill === skill.name);
        const changed = localFingerprint !== null && localFingerprint !== skill.fingerprint;
        out.push({
          sourceId: source.id,
          name: skill.name,
          description: skill.description,
          version: skill.version,
          fingerprint: skill.fingerprint,
          installed,
          localFingerprint,
          changed,
          remoteUpdatedAt: installed ? await this.fetchCommitTime(source, skill.repoPath) : null,
        });
      }
    }
    return out;
  }
}

export { defaultState };
