import {
  mkdtempSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync, strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BACKUP_RETENTION, RippleHub } from './hub.js';
import { defaultState, loadState, saveState } from './state.js';
import { symlinkTypeFor } from './fs-utils.js';
import { parseRepoSpec, payloadFromZip, scanTarballSkills } from './sources.js';
import { parseTar } from './tar.js';
import type { SkillPayload } from './sources.js';

const encoder = new TextEncoder();

function skillMd(name: string, version = '1.0.0'): string {
  return `---\nname: ${name}\ndescription: 用于 hub 单元测试的技能描述内容。\nversion: ${version}\n---\n\n# ${name}\n`;
}

function payload(name: string, version = '1.0.0'): SkillPayload {
  return {
    meta: {
      name,
      description: '用于 hub 单元测试的技能描述内容。',
      version,
      display_name: null,
      category: null,
      tags: null,
    },
    files: {
      'SKILL.md': encoder.encode(skillMd(name, version)),
      'references/guide.md': encoder.encode('# guide'),
    },
  };
}

/** 极简 tar 构造器（与 parseTar 对应） */
function buildTar(files: Record<string, Uint8Array>): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const [path, data] of Object.entries(files)) {
    const header = new Uint8Array(512);
    header.set(encoder.encode(path.slice(0, 100)), 0);
    header.set(encoder.encode('0000644\0'), 100);
    header.set(encoder.encode('0000000\0'), 108);
    header.set(encoder.encode('0000000\0'), 116);
    header.set(encoder.encode(data.length.toString(8).padStart(11, '0') + '\0'), 124);
    header.set(encoder.encode('00000000000\0'), 136);
    header.set(encoder.encode('        '), 148);
    header[156] = 48; // '0' 普通文件
    blocks.push(header);
    blocks.push(data);
    const pad = (512 - (data.length % 512)) % 512;
    if (pad) blocks.push(new Uint8Array(pad));
  }
  blocks.push(new Uint8Array(1024));
  const total = blocks.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of blocks) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

let home: string;
let hub: RippleHub;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'ripple-hub-test-'));
  mkdirSync(join(home, '.claude')); // 模拟已检测到 Claude Code
  hub = new RippleHub({ homeDir: home });
});

afterEach(() => {
  // 临时目录交由 OS 清理；测试内不递归删除以防误删
});

describe('state 持久化', () => {
  it('保存与加载 roundtrip', () => {
    const state = defaultState();
    state.default_agent = 'codex';
    saveState(join(home, '.ripple'), state);
    expect(loadState(join(home, '.ripple')).default_agent).toBe('codex');
  });

  it('损坏文件回退默认状态', () => {
    mkdirSync(join(home, '.ripple'), { recursive: true });
    writeFileSync(join(home, '.ripple', 'state.json'), '{broken json');
    expect(loadState(join(home, '.ripple')).schema_version).toBe(1);
  });
});

describe('安装与分发', () => {
  it('安装到全局：SSOT 落盘 + symlink 分发 + 记录', () => {
    const records = hub.install(payload('demo-skill'), [{ agent: 'claude-code' }]);
    expect(records).toHaveLength(1);
    expect(records[0]!.mode).toBe(process.platform === 'win32' ? 'junction' : 'symlink');
    expect(existsSync(join(home, '.ripple', 'skills', 'demo-skill', 'SKILL.md'))).toBe(true);
    const dist = join(home, '.claude', 'skills', 'demo-skill');
    expect(lstatSync(dist).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(dist, 'SKILL.md'), 'utf8')).toContain('demo-skill');
  });

  it('项目作用域安装独立于全局', () => {
    const project = mkdtempSync(join(tmpdir(), 'ripple-proj-'));
    hub.addProject(project);
    hub.install(payload('demo-skill'), [
      { agent: 'claude-code' },
      { agent: 'claude-code', projectDir: project },
    ]);
    expect(existsSync(join(project, '.claude', 'skills', 'demo-skill'))).toBe(true);
    expect(hub.state.installs).toHaveLength(2);
    expect(new Set(hub.state.installs.map((i) => i.scope)).size).toBe(2);
  });

  it('禁用移除分发但保留 SSOT，启用重建', () => {
    hub.install(payload('demo-skill'), [{ agent: 'claude-code' }]);
    hub.setEnabled('demo-skill', { agent: 'claude-code' }, false);
    expect(existsSync(join(home, '.claude', 'skills', 'demo-skill'))).toBe(false);
    expect(existsSync(join(home, '.ripple', 'skills', 'demo-skill'))).toBe(true);
    hub.setEnabled('demo-skill', { agent: 'claude-code' }, true);
    expect(existsSync(join(home, '.claude', 'skills', 'demo-skill'))).toBe(true);
  });

  it('最后一处卸载后 SSOT 移除但备份保留', () => {
    hub.install(payload('demo-skill'), [{ agent: 'claude-code' }]);
    hub.uninstall('demo-skill');
    expect(existsSync(join(home, '.ripple', 'skills', 'demo-skill'))).toBe(false);
    expect(hub.state.installs).toHaveLength(0);
    const backups = hub.listBackups().filter((b) => b.skill === 'demo-skill');
    expect(backups.length).toBeGreaterThan(0);
    expect(existsSync(backups[0]!.file)).toBe(true);
  });

  it('copy 模式分发为真实目录', () => {
    hub.setDistMode('copy');
    hub.install(payload('demo-skill'), [{ agent: 'claude-code' }]);
    const dist = join(home, '.claude', 'skills', 'demo-skill');
    expect(lstatSync(dist).isSymbolicLink()).toBe(false);
    expect(lstatSync(dist).isDirectory()).toBe(true);
  });

  it('symlinkTypeFor 在 win32 上使用 junction', () => {
    expect(symlinkTypeFor('win32')).toBe('junction');
    expect(symlinkTypeFor('linux')).toBe('dir');
  });
});

describe('同步收敛', () => {
  it('勾选集合决定最终安装矩阵', () => {
    mkdirSync(join(home, '.codex'));
    hub.install(payload('demo-skill'), [{ agent: 'claude-code' }]);
    hub.sync('demo-skill', [{ agent: 'codex' }]);
    expect(existsSync(join(home, '.claude', 'skills', 'demo-skill'))).toBe(false);
    expect(existsSync(join(home, '.codex', 'skills', 'demo-skill'))).toBe(true);
    expect(hub.state.installs.map((i) => i.agent)).toEqual(['codex']);
    const history = hub.state.history['demo-skill']!;
    expect(history[0]!.action).toBe('sync');
  });
});

describe('备份与回退', () => {
  it('更新自动备份旧版本，restore 回到旧版并重建分发', () => {
    hub.install(payload('demo-skill', '1.0.0'), [{ agent: 'claude-code' }]);
    hub.install(payload('demo-skill', '2.0.0'), [{ agent: 'claude-code' }]);
    expect(hub.installedVersion('demo-skill')).toBe('2.0.0');
    const backup = hub.listBackups().find((b) => b.skill === 'demo-skill' && b.version === 'v1.0.0');
    expect(backup).toBeDefined();
    hub.restoreBackup(backup!.id);
    expect(hub.installedVersion('demo-skill')).toBe('1.0.0');
    const dist = join(home, '.claude', 'skills', 'demo-skill', 'SKILL.md');
    expect(readFileSync(dist, 'utf8')).toContain('version: 1.0.0');
    expect(hub.state.history['demo-skill']![0]!.action).toBe('rollback');
  });

  it(`全局保留最近 ${BACKUP_RETENTION} 份（FIFO）`, () => {
    let tick = 0;
    const hub2 = new RippleHub({
      homeDir: home,
      now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
    });
    hub2.install(payload('a-skill'), [{ agent: 'claude-code' }]);
    for (let i = 0; i < BACKUP_RETENTION + 3; i++) {
      hub2.createBackup('a-skill', `第 ${i} 次`);
    }
    expect(hub2.listBackups()).toHaveLength(BACKUP_RETENTION);
    for (const b of hub2.listBackups()) expect(existsSync(b.file)).toBe(true);
  });

  it('删除备份不可恢复', () => {
    hub.install(payload('demo-skill'), [{ agent: 'claude-code' }]);
    const backup = hub.createBackup('demo-skill', '手动备份')!;
    hub.deleteBackup(backup.id);
    expect(existsSync(backup.file)).toBe(false);
    expect(hub.listBackups().find((b) => b.id === backup.id)).toBeUndefined();
  });
});

describe('版本冲突', () => {
  it('多处版本不一致被检出，unify 后消除', () => {
    hub.install(payload('demo-skill', '2.0.0'), [{ agent: 'claude-code' }]);
    // 人为制造不一致记录
    hub.state.installs.push({
      skill: 'demo-skill',
      version: '1.0.0',
      agent: 'codex',
      scope: 'global',
      enabled: true,
      mode: 'symlink',
      installed_at: new Date().toISOString(),
    });
    expect(hub.conflicts().get('demo-skill')).toEqual(['1.0.0', '2.0.0']);
    hub.unifyVersions('demo-skill');
    expect(hub.conflicts().size).toBe(0);
  });
});

describe('存储位置迁移', () => {
  it('内置 → 共享：内容迁移、链接重建、状态不丢', () => {
    hub.install(payload('demo-skill'), [{ agent: 'claude-code' }]);
    hub.setEnabled('demo-skill', { agent: 'claude-code' }, false);
    hub.setEnabled('demo-skill', { agent: 'claude-code' }, true);
    hub.setStorageLocation('shared');
    expect(existsSync(join(home, '.agents', 'skills', 'demo-skill', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(home, '.ripple', 'skills'))).toBe(false);
    const dist = join(home, '.claude', 'skills', 'demo-skill');
    expect(readFileSync(join(dist, 'SKILL.md'), 'utf8')).toContain('demo-skill');
    expect(hub.state.installs[0]!.enabled).toBe(true);
  });
});

describe('来源', () => {
  it('repo spec 解析', () => {
    expect(parseRepoSpec('anthropics/skills')).toEqual({
      owner: 'anthropics',
      repo: 'skills',
      branch: 'main',
      subdir: '',
    });
    expect(parseRepoSpec('ComposioHQ/skills#dev:packs')).toEqual({
      owner: 'ComposioHQ',
      repo: 'skills',
      branch: 'dev',
      subdir: 'packs',
    });
    expect(() => parseRepoSpec('not-a-spec')).toThrow();
  });

  it('ZIP 路径穿越被拒绝', () => {
    const evil = zipSync({ '../../evil.md': strToU8('x'), 'SKILL.md': strToU8(skillMd('evil')) });
    expect(() => payloadFromZip(evil)).toThrow(/Unsafe path/);
  });

  it('tarball 扫描发现 SKILL.md 目录（支持子目录过滤）', () => {
    const tar = buildTar({
      'repo-main/skills/foo/SKILL.md': strToU8(skillMd('foo')),
      'repo-main/skills/foo/scripts/run.py': strToU8('print(1)'),
      'repo-main/other/bar/SKILL.md': strToU8(skillMd('bar')),
      'repo-main/README.md': strToU8('# readme'),
    });
    const tarGz = gzipSync(tar);
    const all = scanTarballSkills(tarGz).skills.map((s) => s.name).sort();
    expect(all).toEqual(['bar', 'foo']);
    const scoped = scanTarballSkills(tarGz, 'skills').skills.map((s) => s.name);
    expect(scoped).toEqual(['foo']);
  });

  it('installFromRepo（mock fetch）未登录本地可用', async () => {
    const tarGz = gzipSync(
      buildTar({ 'repo-main/foo/SKILL.md': strToU8(skillMd('foo', '3.1.0')) }),
    );
    const fetchImpl = (async () => new Response(tarGz.slice().buffer)) as unknown as typeof fetch;
    const hub3 = new RippleHub({ homeDir: home, fetchImpl });
    hub3.addSource('acme/skills');
    const records = await hub3.installFromRepo('acme/skills', 'foo', [{ agent: 'claude-code' }]);
    expect(records[0]!.version).toBe('3.1.0');
    expect(existsSync(join(home, '.ripple', 'skills', 'foo', 'SKILL.md'))).toBe(true);
  });

  it('内置来源不可删除；移除自定义来源后已装技能保留', async () => {
    expect(() => hub.removeSource('anthropics/skills')).toThrow();
    const tarGz = gzipSync(buildTar({ 'r-main/foo/SKILL.md': strToU8(skillMd('foo')) }));
    const fetchImpl = (async () => new Response(tarGz.slice().buffer)) as unknown as typeof fetch;
    const hub3 = new RippleHub({ homeDir: home, fetchImpl });
    hub3.addSource('acme/skills');
    await hub3.installFromRepo('acme/skills', 'foo', [{ agent: 'claude-code' }]);
    hub3.removeSource('acme/skills');
    expect(existsSync(join(home, '.ripple', 'skills', 'foo'))).toBe(true);
    expect(hub3.listSources().find((s) => s.id === 'acme/skills')).toBeUndefined();
  });
});

describe('扫描', () => {
  it('unmanaged 技能被识别', () => {
    mkdirSync(join(home, '.claude', 'skills', 'hand-made-skill'), { recursive: true });
    const issues = hub.scan();
    expect(issues.some((i) => i.kind === 'unmanaged' && i.skill === 'hand-made-skill')).toBe(true);
  });

  it('分发丢失被识别为 missing', () => {
    hub.install(payload('demo-skill'), [{ agent: 'claude-code' }]);
    const dist = join(home, '.claude', 'skills', 'demo-skill');
    rmSync(dist, { recursive: true, force: true });
    const issues = hub.scan();
    expect(issues.some((i) => i.kind === 'missing' && i.skill === 'demo-skill')).toBe(true);
  });
});

describe('tar 解析', () => {
  it('roundtrip', () => {
    const tar = buildTar({ 'a/b.txt': strToU8('hello'), 'c.txt': strToU8('world') });
    const entries = parseTar(tar);
    expect(entries.map((e) => e.path)).toEqual(['a/b.txt', 'c.txt']);
    expect(new TextDecoder().decode(entries[0]!.data)).toBe('hello');
  });
});

describe('接管既有技能（adopt）', () => {
  it('扫描到的 unmanaged 技能被接管：进入 SSOT、纳入安装记录、原目录保留', () => {
    const dir = join(home, '.claude', 'skills', 'pre-existing');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), skillMd('pre-existing', '2.3.0'));
    mkdirSync(join(home, '.claude', 'skills', 'not-a-skill'), { recursive: true });

    const unmanaged = hub.listUnmanaged();
    expect(unmanaged.find((u) => u.skill === 'pre-existing')?.version).toBe('2.3.0');

    const { adopted, skipped } = hub.adoptAll();
    expect(adopted.map((a) => a.skill)).toContain('pre-existing');
    expect(skipped.map((s) => s.skill)).toContain('not-a-skill');

    expect(existsSync(join(home, '.ripple', 'skills', 'pre-existing', 'SKILL.md'))).toBe(true);
    expect(existsSync(dir)).toBe(true); // 原目录不动
    const record = hub.state.installs.find((i) => i.skill === 'pre-existing')!;
    expect(record).toMatchObject({ agent: 'claude-code', version: '2.3.0', mode: 'copy', enabled: true });
    // 再扫不再出现 unmanaged
    expect(hub.listUnmanaged().find((u) => u.skill === 'pre-existing')).toBeUndefined();
    expect(hub.scan().find((i) => i.kind === 'unmanaged' && i.skill === 'pre-existing')).toBeUndefined();
    expect(hub.state.history['pre-existing']![0]!.detail).toContain('接管');
  });

  it('adoptAll 幂等：二次调用不重复接管', () => {
    const dir = join(home, '.claude', 'skills', 'once-only');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), skillMd('once-only'));
    hub.adoptAll();
    const count = hub.state.installs.filter((i) => i.skill === 'once-only').length;
    hub.adoptAll();
    expect(hub.state.installs.filter((i) => i.skill === 'once-only').length).toBe(count);
  });
});
