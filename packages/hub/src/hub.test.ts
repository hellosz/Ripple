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
import { parseRepoSpec, payloadFromZip, scanTarballSkills, tarballUrl } from './sources.js';
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
  // 本文件的既有用例以内置存储语义书写；共享目录（新默认）语义见「共享目录 placement」用例组
  hub.state.storage_location = 'builtin';
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

  it('hidden_files 默认值存在；旧 state 文件加载后自动补齐（前向兼容）', () => {
    expect(defaultState().hidden_files).toContain('.openskills.json');
    const legacy = { ...defaultState() } as Record<string, unknown>;
    delete legacy.hidden_files;
    mkdirSync(join(home, '.ripple'), { recursive: true });
    writeFileSync(join(home, '.ripple', 'state.json'), JSON.stringify(legacy));
    expect(loadState(join(home, '.ripple')).hidden_files).toContain('.openskills.json');
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
  it('勾选集合决定最终安装矩阵（共享型 Agent 默认共享落点，dedicated 显式专属）', () => {
    mkdirSync(join(home, '.codex'));
    hub.install(payload('demo-skill'), [{ agent: 'claude-code' }]);
    hub.sync('demo-skill', [{ agent: 'codex' }]);
    expect(existsSync(join(home, '.claude', 'skills', 'demo-skill'))).toBe(false);
    // codex 支持共享标准：默认经 ~/.agents/skills 共享（内置 SSOT → 建链接），不落 .codex 专属目录
    expect(existsSync(join(home, '.codex', 'skills', 'demo-skill'))).toBe(false);
    expect(lstatSync(join(home, '.agents', 'skills', 'demo-skill')).isSymbolicLink()).toBe(true);
    expect(hub.state.installs.map((i) => i.agent)).toEqual(['codex']);
    expect(hub.state.installs[0]!.mode).toBe('shared');
    // 显式 dedicated → 专属分发
    hub.sync('demo-skill', [{ agent: 'codex', dedicated: true }]);
    expect(existsSync(join(home, '.codex', 'skills', 'demo-skill'))).toBe(true);
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
      provider: 'github',
      owner: 'anthropics',
      repo: 'skills',
      branch: 'main',
      subdir: '',
    });
    expect(parseRepoSpec('ComposioHQ/skills#dev:packs')).toEqual({
      provider: 'github',
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
    hub3.state.storage_location = 'builtin';
    hub3.addSource('acme/skills');
    const records = await hub3.installFromRepo('acme/skills', 'foo', [{ agent: 'claude-code' }]);
    expect(records[0]!.version).toBe('3.1.0');
    expect(existsSync(join(home, '.ripple', 'skills', 'foo', 'SKILL.md'))).toBe(true);
  });

  it('内置来源可移除并可重新添加；移除自定义来源后已装技能保留', async () => {
    hub.removeSource('anthropics/skills');
    expect(hub.listSources().find((s) => s.id === 'anthropics/skills')).toBeUndefined();
    hub.addSource('anthropics/skills');
    expect(hub.listSources().find((s) => s.id === 'anthropics/skills')).toBeDefined();
    const tarGz = gzipSync(buildTar({ 'r-main/foo/SKILL.md': strToU8(skillMd('foo')) }));
    const fetchImpl = (async () => new Response(tarGz.slice().buffer)) as unknown as typeof fetch;
    const hub3 = new RippleHub({ homeDir: home, fetchImpl });
    hub3.state.storage_location = 'builtin';
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

describe('存储位置切换不得破坏共享目录（回归：用户数据事故）', () => {
  it('shared → builtin：共享目录中非纳管内容原样保留，目录不被删除', () => {
    // 共享目录里有其他工具（如 lark-cli）放置的技能
    const foreign = join(home, '.agents', 'skills', 'lark-foreign');
    mkdirSync(foreign, { recursive: true });
    writeFileSync(join(foreign, 'SKILL.md'), skillMd('lark-foreign'));

    // hub 在 shared 模式下纳管一个技能
    hub.setStorageLocation('shared');
    hub.install(payload('mine'), [{ agent: 'claude-code' }]);

    // 切回 builtin
    hub.setStorageLocation('builtin');

    // 纳管技能迁到了内置目录且分发有效
    expect(existsSync(join(home, '.ripple', 'skills', 'mine', 'SKILL.md'))).toBe(true);
    expect(readFileSync(join(home, '.claude', 'skills', 'mine', 'SKILL.md'), 'utf8')).toContain('mine');
    // 共享目录整体保留、外部内容毫发无损
    expect(existsSync(join(home, '.agents', 'skills'))).toBe(true);
    expect(readFileSync(join(foreign, 'SKILL.md'), 'utf8')).toContain('lark-foreign');
  });

  it('builtin → shared：只迁移纳管技能，不影响共享目录既有内容；内置目录被清理', () => {
    const foreign = join(home, '.agents', 'skills', 'lark-keep');
    mkdirSync(foreign, { recursive: true });
    writeFileSync(join(foreign, 'SKILL.md'), skillMd('lark-keep'));

    hub.install(payload('mine'), [{ agent: 'claude-code' }]);
    hub.setStorageLocation('shared');

    expect(existsSync(join(home, '.agents', 'skills', 'mine', 'SKILL.md'))).toBe(true);
    expect(readFileSync(join(foreign, 'SKILL.md'), 'utf8')).toContain('lark-keep');
    // 内置目录是 hub 独占，可清理
    expect(existsSync(join(home, '.ripple', 'skills'))).toBe(false);
  });

  it('往返切换后外部内容依然完好', () => {
    const foreign = join(home, '.agents', 'skills', 'lark-roundtrip');
    mkdirSync(foreign, { recursive: true });
    writeFileSync(join(foreign, 'SKILL.md'), skillMd('lark-roundtrip'));
    hub.install(payload('mine'), [{ agent: 'claude-code' }]);
    hub.setStorageLocation('shared');
    hub.setStorageLocation('builtin');
    hub.setStorageLocation('shared');
    expect(readFileSync(join(foreign, 'SKILL.md'), 'utf8')).toContain('lark-roundtrip');
    expect(hub.installedVersion('mine')).toBe('1.0.0');
  });
});

describe('共享目录 placement（agentskills.io 标准）', () => {
  function sharedHub(): RippleHub {
    const h = new RippleHub({ homeDir: home });
    // 新默认即 shared
    expect(h.state.storage_location).toBe('shared');
    return h;
  }

  it('装到支持共享标准的 Agent（Codex）：mode=shared，零分发', () => {
    mkdirSync(join(home, '.codex'));
    const h = sharedHub();
    const records = h.install(payload('shared-skill'), [{ agent: 'codex' }]);
    expect(records[0]!.mode).toBe('shared');
    expect(existsSync(join(home, '.agents', 'skills', 'shared-skill', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(home, '.codex', 'skills', 'shared-skill'))).toBe(false);
  });

  it('装到不支持共享的 Agent（Claude Code）：仍专属分发', () => {
    const h = sharedHub();
    const records = h.install(payload('shared-skill'), [{ agent: 'claude-code' }]);
    expect(records[0]!.mode).not.toBe('shared');
    expect(existsSync(join(home, '.claude', 'skills', 'shared-skill'))).toBe(true);
  });

  it('dedicated 个性化强制专属分发（即使 Codex 支持共享）', () => {
    mkdirSync(join(home, '.codex'));
    const h = sharedHub();
    const records = h.install(payload('shared-skill'), [{ agent: 'codex', dedicated: true }]);
    expect(records[0]!.mode).not.toBe('shared');
    expect(existsSync(join(home, '.codex', 'skills', 'shared-skill'))).toBe(true);
  });

  it('shared placement 不支持启停', () => {
    const h = sharedHub();
    h.install(payload('shared-skill'), [{ agent: 'codex' }]);
    expect(() => h.setEnabled('shared-skill', { agent: 'codex' }, false)).toThrow(/通用/);
  });

  it('addPlacement 补齐：不触发备份、写历史与操作日志', () => {
    const h = sharedHub();
    h.install(payload('shared-skill'), [{ agent: 'claude-code' }]);
    const before = h.listBackups().length;
    const record = h.addPlacement('shared-skill', { agent: 'codex' });
    expect(record.mode).toBe('shared');
    expect(h.listBackups().length).toBe(before);
    expect(h.state.history['shared-skill']![0]!.detail).toContain('补齐');
    expect(h.state.oplog[0]!.action).toBe('补齐');
  });

  it('卸载最后一处仅删除 owned 的 SSOT；他人放置的内容保留', () => {
    const h = sharedHub();
    // 模拟其他工具放置的技能（非 hub 写入 → 非 owned）
    const foreign = join(home, '.agents', 'skills', 'lark-x');
    mkdirSync(foreign, { recursive: true });
    writeFileSync(join(foreign, 'SKILL.md'), skillMd('lark-x'));
    h.addPlacement('lark-x', { agent: 'codex' });
    h.uninstall('lark-x');
    expect(existsSync(join(foreign, 'SKILL.md'))).toBe(true);
    // hub 自己安装的（owned）正常删除
    h.install(payload('mine'), [{ agent: 'codex' }]);
    h.uninstall('mine');
    expect(existsSync(join(home, '.agents', 'skills', 'mine'))).toBe(false);
  });
});

describe('GitLab 私服来源', () => {
  it('URL spec 解析（含分支与子目录）', () => {
    expect(parseRepoSpec('https://gitlab.corp.local/team/skills#dev:packs')).toEqual({
      provider: 'gitlab',
      host: 'gitlab.corp.local',
      owner: 'team',
      repo: 'skills',
      branch: 'dev',
      subdir: 'packs',
    });
    expect(parseRepoSpec('https://github.com/anthropics/skills').provider).toBe('github');
  });

  it('tarball URL：gitlab 走 /-/archive，github 走 codeload', () => {
    expect(
      tarballUrl({ provider: 'gitlab', host: 'gitlab.corp.local', owner: 't', repo: 'r', branch: 'main' }),
    ).toBe('https://gitlab.corp.local/t/r/-/archive/main/r-main.tar.gz');
    expect(tarballUrl({ provider: 'github', owner: 'a', repo: 'b', branch: 'main' })).toBe(
      'https://codeload.github.com/a/b/tar.gz/main',
    );
  });

  it('installFromRepo 走 gitlab tarball（mock fetch 校验 URL）', async () => {
    const tarGz = gzipSync(buildTar({ 'r-main/foo/SKILL.md': strToU8(skillMd('foo')) }));
    let fetched = '';
    const fetchImpl = (async (url: string) => {
      fetched = String(url);
      return new Response(tarGz.slice().buffer);
    }) as unknown as typeof fetch;
    const h = new RippleHub({ homeDir: home, fetchImpl });
    h.addSource('https://gitlab.corp.local/acme/r#main');
    await h.installFromRepo('gitlab.corp.local/acme/r', 'foo', [{ agent: 'claude-code' }]);
    expect(fetched).toBe('https://gitlab.corp.local/acme/r/-/archive/main/r-main.tar.gz');
    expect(h.installedVersion('foo')).toBe('1.0.0');
  });
});

describe('操作日志与批量备份', () => {
  it('操作全链路留痕且上限 500', () => {
    hub.install(payload('a-skill'), [{ agent: 'claude-code' }]);
    hub.sync('a-skill', [{ agent: 'claude-code' }]);
    hub.uninstall('a-skill');
    const actions = hub.state.oplog.map((o) => o.action);
    expect(actions).toEqual(expect.arrayContaining(['安装', '同步', '卸载']));
    for (let i = 0; i < 520; i++) hub.logOp('测试', 'x', String(i));
    expect(hub.state.oplog.length).toBe(500);
  });

  it('按 Agent 批量备份（多选去重 + 共享标准 Agent 计入共享库）', () => {
    mkdirSync(join(home, '.codex'));
    hub.install(payload('s1'), [{ agent: 'claude-code' }, { agent: 'codex' }]);
    hub.install(payload('s2'), [{ agent: 'claude-code' }]);
    const records = hub.backupAgents(['claude-code', 'codex']);
    expect(new Set(records.map((r) => r.skill))).toEqual(new Set(['s1', 's2']));
    expect(records[0]!.reason).toContain('手动备份');
    expect(hub.state.oplog[0]!.action).toBe('批量备份');
  });
});

describe('项目目录接管（回归：导入项目后技能不可见）', () => {
  it('addProject 后 adoptAll 接管项目内 .claude/.codex 既有技能（scope=项目路径）', () => {
    const project = mkdtempSync(join(tmpdir(), 'ripple-proj-adopt-'));
    for (const rel of ['.claude/skills/proj-a', '.codex/skills/proj-b']) {
      mkdirSync(join(project, rel), { recursive: true });
      const name = rel.split('/').pop()!;
      writeFileSync(join(project, rel, 'SKILL.md'), skillMd(name));
    }
    hub.addProject(project);
    const unmanaged = hub.listUnmanaged().filter((u) => u.scope === project);
    expect(unmanaged.map((u) => u.skill).sort()).toEqual(['proj-a', 'proj-b']);
    const { adopted } = hub.adoptAll();
    const projRecords = hub.state.installs.filter((i) => i.scope === project);
    expect(projRecords.map((r) => `${r.agent}:${r.skill}`).sort()).toEqual([
      'claude-code:proj-a',
      'codex:proj-b',
    ]);
    expect(adopted.length).toBeGreaterThanOrEqual(2);
  });
});

describe('desktop-polish-v2：项目清理 / 批量操作 / 编辑器后端', () => {
  it('removeProject 清理作用域记录但保留项目文件', () => {
    const project = mkdtempSync(join(tmpdir(), 'ripple-proj-clean-'));
    hub.addProject(project);
    hub.install(payload('p-skill'), [{ agent: 'claude-code', projectDir: project }]);
    expect(hub.state.installs.filter((i) => i.scope === project)).toHaveLength(1);
    hub.removeProject(project);
    expect(hub.state.installs.filter((i) => i.scope === project)).toHaveLength(0);
    expect(hub.state.projects.find((p) => p.path === project)).toBeUndefined();
    expect(hub.state.oplog[0]!.action).toBe('移除项目');
  });

  it('applyAllToAgent / removeAllFromAgent：批量补齐与取消，SSOT 保留', () => {
    mkdirSync(join(home, '.codex'));
    hub.install(payload('b1'), [{ agent: 'claude-code' }]);
    hub.install(payload('b2'), [{ agent: 'claude-code' }]);
    const backupsBefore = hub.listBackups().length;

    const applied = hub.applyAllToAgent('codex');
    expect(applied.map((r) => r.skill).sort()).toEqual(['b1', 'b2']);
    // 免逐技能备份
    expect(hub.listBackups().length).toBe(backupsBefore);
    // 幂等
    expect(hub.applyAllToAgent('codex')).toHaveLength(0);

    const removed = hub.removeAllFromAgent('codex');
    expect(removed).toBe(2);
    expect(hub.state.installs.filter((i) => i.agent === 'codex')).toHaveLength(0);
    expect(existsSync(join(home, '.ripple', 'skills', 'b1', 'SKILL.md'))).toBe(true);
    expect(hub.state.installs.filter((i) => i.agent === 'claude-code')).toHaveLength(2);
  });

  it('readSkillFiles：SKILL.md 置顶、二进制以 binary 条目列出（内容留空）', () => {
    hub.install(payload('e-skill'), [{ agent: 'claude-code' }]);
    writeFileSync(join(home, '.ripple', 'skills', 'e-skill', 'logo.png'), new Uint8Array([0x89, 0x50, 0x00, 0xff]));
    const files = hub.readSkillFiles('e-skill');
    expect(files[0]!.path).toBe('SKILL.md');
    const logo = files.find((f) => f.path === 'logo.png');
    expect(logo).toMatchObject({ binary: true, content: '', size: 4 });
    expect(files.find((f) => f.path === 'references/guide.md')?.binary).toBeUndefined();
  });

  it('writeSkillFile：拒绝路径穿越、写回后 copy 分发同步', () => {
    hub.setDistMode('copy');
    hub.install(payload('e-skill'), [{ agent: 'claude-code' }]);
    expect(() => hub.writeSkillFile('e-skill', '../evil.md', 'x')).toThrow(/Unsafe/);
    hub.writeSkillFile('e-skill', 'SKILL.md', skillMd('e-skill', '9.9.9'));
    expect(hub.installedVersion('e-skill')).toBe('9.9.9');
    expect(readFileSync(join(home, '.claude', 'skills', 'e-skill', 'SKILL.md'), 'utf8')).toContain('9.9.9');
    expect(hub.state.oplog[0]!.action).toBe('编辑');
  });
});

describe('community-sources：指纹 / origin / 社区更新', () => {
  it('树哈希：目录与 tarball 内容一致时指纹相同，文件变更后不同', async () => {
    const { treeHashFromFiles, treeHashFromDir } = await import('./fingerprint.js');
    const files = { 'SKILL.md': strToU8(skillMd('fp')), 'references/a.md': strToU8('# a') };
    const h1 = treeHashFromFiles(files);
    hub.install(
      { meta: { name: 'fp', description: 'x', version: '1.0.0', display_name: null, category: null, tags: null }, files },
      [{ agent: 'claude-code' }],
    );
    expect(treeHashFromDir(join(home, '.ripple', 'skills', 'fp'))).toBe(h1);
    expect(treeHashFromFiles({ ...files, 'references/a.md': strToU8('# changed') })).not.toBe(h1);
  });

  it('origin 全路径落点：registry 显式传入 / repo / zip / adopt / placement 继承', async () => {
    // 显式（registry 场景由调用方传入）
    hub.install(payload('o-reg'), [{ agent: 'claude-code' }], { origin: 'registry' });
    expect(hub.state.installs.find((i) => i.skill === 'o-reg')!.origin).toBe('registry');
    // zip
    const zip = zipSync({ 'SKILL.md': strToU8(skillMd('o-zip')) });
    hub.installFromZip(zip, [{ agent: 'claude-code' }]);
    expect(hub.state.installs.find((i) => i.skill === 'o-zip')!.origin).toBe('zip');
    // repo
    const tarGz = gzipSync(buildTar({ 'r-main/o-repo/SKILL.md': strToU8(skillMd('o-repo')) }));
    const fetchImpl = (async () => new Response(tarGz.slice().buffer)) as unknown as typeof fetch;
    const h = new RippleHub({ homeDir: home, fetchImpl });
    h.state.storage_location = 'builtin';
    h.addSource('acme/o');
    await h.installFromRepo('acme/o', 'o-repo', [{ agent: 'claude-code' }]);
    expect(h.state.installs.find((i) => i.skill === 'o-repo')!.origin).toBe('repo:acme/o');
    // placement 继承
    mkdirSync(join(home, '.codex'), { recursive: true });
    hub.addPlacement('o-reg', { agent: 'codex' });
    expect(
      hub.state.installs.find((i) => i.skill === 'o-reg' && i.agent === 'codex')!.origin,
    ).toBe('registry');
  });

  it('communitySnapshot：指纹比对判定更新，提交时间仅对本地存在的技能获取', async () => {
    const remoteMd = skillMd('cs-skill', '2.0.0');
    const tarGz = gzipSync(buildTar({ 'r-main/cs-skill/SKILL.md': strToU8(remoteMd) }));
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      if (String(url).includes('api.github.com')) {
        return new Response(JSON.stringify([{ commit: { committer: { date: '2026-08-20T10:00:00Z' } } }]), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(tarGz.slice().buffer);
    }) as unknown as typeof fetch;
    const h = new RippleHub({ homeDir: home, fetchImpl });
    h.state.storage_location = 'builtin';
    h.state.sources = [
      { id: 'acme/cs', owner: 'acme', repo: 'cs', branch: 'main', subdir: '', note: '', builtin: false, provider: 'github' },
    ];

    // 本地不存在：installed=false，不查提交时间
    let snap = await h.communitySnapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0]).toMatchObject({ name: 'cs-skill', installed: false, changed: false, remoteUpdatedAt: null });
    expect(calls.filter((c) => c.includes('api.github.com'))).toHaveLength(0);

    // 安装旧版本 → changed=true，且拿到提交时间
    h.install(payload('cs-skill', '1.0.0'), [{ agent: 'claude-code' }]);
    snap = await h.communitySnapshot();
    expect(snap[0]).toMatchObject({ installed: true, changed: true, remoteUpdatedAt: '2026-08-20T10:00:00Z' });
    expect(snap[0]!.localFingerprint).not.toBe(snap[0]!.fingerprint);

    // 安装远端同内容 → changed=false
    h.install(
      { meta: { name: 'cs-skill', description: 'x', version: '2.0.0', display_name: null, category: null, tags: null }, files: { 'SKILL.md': strToU8(remoteMd) } },
      [{ agent: 'claude-code' }],
    );
    snap = await h.communitySnapshot();
    expect(snap[0]!.changed).toBe(false);
  });
});

describe('desktop-refinements-v3：场景分析 / 素材预览 / github.com 来源', () => {
  it('场景分析持久化：save/get roundtrip，重载后仍在，卸载最后落点时清理', () => {
    hub.install(payload('sc-skill'), [{ agent: 'claude-code' }]);
    const fingerprint = hub.fingerprintOf('sc-skill')!;
    expect(fingerprint).toBeTruthy();
    const analysis = {
      tags: { business: ['研发效能'], role: ['后端工程师'], scene: ['代码评审'], tool: ['Git'] },
      summary: '帮助工程师在评审场景快速定位问题。',
      fingerprint,
      at: new Date().toISOString(),
    };
    hub.saveScenario('sc-skill', analysis);
    expect(hub.getScenario('sc-skill')).toEqual(analysis);
    // 重载持久化
    const hub2 = new RippleHub({ homeDir: home });
    expect(hub2.getScenario('sc-skill')).toEqual(analysis);
    // 卸载最后落点后清理
    hub.uninstall('sc-skill', { agent: 'claude-code' });
    expect(hub.getScenario('sc-skill')).toBeNull();
    expect(new RippleHub({ homeDir: home }).getScenario('sc-skill')).toBeNull();
  });

  it('fingerprintOf：内容变更后指纹变化；不存在的技能返回 null', () => {
    hub.install(payload('fp-skill'), [{ agent: 'claude-code' }]);
    const before = hub.fingerprintOf('fp-skill')!;
    hub.writeSkillFile('fp-skill', 'references/guide.md', '# changed');
    expect(hub.fingerprintOf('fp-skill')).not.toBe(before);
    expect(hub.fingerprintOf('nope')).toBeNull();
  });

  it('readSkillAsset：二进制返回 base64+mime，未知扩展名为 octet-stream', () => {
    const p = payload('asset-skill');
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    p.files['assets/logo.png'] = png;
    p.files['assets/data.bin'] = new Uint8Array([1, 2, 3]);
    hub.install(p, [{ agent: 'claude-code' }]);
    const asset = hub.readSkillAsset('asset-skill', 'assets/logo.png');
    expect(asset.mime).toBe('image/png');
    expect(asset.size).toBe(png.length);
    expect(new Uint8Array(Buffer.from(asset.base64, 'base64'))).toEqual(png);
    expect(hub.readSkillAsset('asset-skill', 'assets/data.bin').mime).toBe('application/octet-stream');
  });

  it('readSkillAsset：路径穿越与绝对路径拒绝，不存在文件报错', () => {
    hub.install(payload('asset-guard'), [{ agent: 'claude-code' }]);
    expect(() => hub.readSkillAsset('asset-guard', '../other/SKILL.md')).toThrow(/Unsafe path/);
    expect(() => hub.readSkillAsset('asset-guard', '/etc/passwd')).toThrow(/Unsafe path/);
    expect(() => hub.readSkillAsset('asset-guard', 'assets/none.png')).toThrow(/not found/);
  });

  it('parseRepoSpec：github.com URL 不保留 host，label 与简写一致', () => {
    const fromUrl = parseRepoSpec('https://github.com/anthropics/skills#main:packs');
    expect(fromUrl).toEqual({
      provider: 'github',
      owner: 'anthropics',
      repo: 'skills',
      branch: 'main',
      subdir: 'packs',
    });
    expect('host' in fromUrl).toBe(false);
    expect(parseRepoSpec('https://www.github.com/a/b')).not.toHaveProperty('host');
    // 私服 GitLab 仍保留 host
    expect(parseRepoSpec('https://gitlab.corp.local/team/skills')).toHaveProperty(
      'host',
      'gitlab.corp.local',
    );
  });
});

describe('decouple-shared-storage：共享目录始终识别 / 共享落点解耦', () => {
  it('内置存储下识别共享目录中的第三方技能（解析回退）', () => {
    // hub 处于 builtin；第三方工具直接把技能放进 ~/.agents/skills
    const sharedDir = join(home, '.agents', 'skills', 'ask-matt');
    mkdirSync(sharedDir, { recursive: true });
    writeFileSync(join(sharedDir, 'SKILL.md'), skillMd('ask-matt'));
    expect(hub.listSkillNames()).toContain('ask-matt');
    expect(hub.skillDir('ask-matt')).toBe(sharedDir);
    expect(hub.skillInSharedDir('ask-matt')).toBe(true);
    // 同名技能装进内置 SSOT 后以 SSOT 为准
    hub.install(payload('ask-matt'), [{ agent: 'claude-code' }]);
    expect(hub.skillDir('ask-matt')).toBe(join(home, '.ripple', 'skills', 'ask-matt'));
  });

  it('内置 SSOT 技能共享 → 共享目录建 symlink；移除后仅删链接不碰第三方内容', () => {
    mkdirSync(join(home, '.codex'), { recursive: true });
    hub.install(payload('foo'), [{ agent: 'claude-code' }]);
    // 第三方真实目录（应始终不动）
    const thirdParty = join(home, '.agents', 'skills', 'vendor-skill');
    mkdirSync(thirdParty, { recursive: true });
    writeFileSync(join(thirdParty, 'SKILL.md'), skillMd('vendor-skill'));
    // 共享到支持共享标准的 codex
    const rec = hub.addPlacement('foo', { agent: 'codex' });
    expect(rec.mode).toBe('shared');
    const link = join(home, '.agents', 'skills', 'foo');
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(hub.skillInSharedDir('foo')).toBe(true);
    // 移除该共享落点：链接被删，第三方目录保留
    hub.uninstall('foo', { agent: 'codex' });
    expect(existsSync(link)).toBe(false);
    expect(existsSync(join(thirdParty, 'SKILL.md'))).toBe(true);
  });

  it('共享目录存在同名非技能残留时共享失败并明示，不覆盖', () => {
    mkdirSync(join(home, '.codex'), { recursive: true });
    hub.install(payload('bar'), [{ agent: 'claude-code' }]);
    const conflict = join(home, '.agents', 'skills', 'bar');
    mkdirSync(conflict, { recursive: true });
    writeFileSync(join(conflict, 'notes.txt'), 'user content');
    expect(() => hub.addPlacement('bar', { agent: 'codex' })).toThrow(/不会覆盖/);
    expect(readFileSync(join(conflict, 'notes.txt'), 'utf8')).toBe('user content');
  });

  it('通用存储模式行为不变：SSOT 即共享目录，零分发', () => {
    const hub2 = new RippleHub({ homeDir: home });
    hub2.state.storage_location = 'shared';
    mkdirSync(join(home, '.codex'), { recursive: true });
    hub2.install(payload('baz'), [{ agent: 'codex' }]);
    const rec = hub2.state.installs.find((i) => i.skill === 'baz' && i.agent === 'codex')!;
    expect(rec.mode).toBe('shared');
    // SSOT 本体在共享目录，不是链接
    expect(lstatSync(join(home, '.agents', 'skills', 'baz')).isSymbolicLink()).toBe(false);
  });
});
