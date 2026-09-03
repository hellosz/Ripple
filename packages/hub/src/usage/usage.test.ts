import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { UsageCollector } from './collector.js';
import { UsageStore, usageEventId } from './store.js';
import { createOpencodeProbe, type SqliteModule } from './probe-opencode.js';
import type { UsageEvent, UsageSettings } from './types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

let home: string;
let settings: UsageSettings;

function makeCollector(overrides: Partial<ConstructorParameters<typeof UsageCollector>[0]> = {}): UsageCollector {
  return new UsageCollector({
    homeDir: home,
    knownSkills: () => ['demo-deploy', 'demo-review'],
    settings: () => settings,
    ...overrides,
  });
}

function event(id: string, skill: string, at: string, project = '/proj/x'): UsageEvent {
  return {
    id,
    skill,
    agent: 'claude-code',
    session_id: 'sess',
    project_dir: project,
    occurred_at: at,
    evidence: 'tool-call',
    source_file: '/f.jsonl',
  };
}

function seedClaudeFixture(): string {
  const dir = join(home, '.claude', 'projects', '-proj-alpha');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'sess-0001.jsonl');
  cpSync(join(FIXTURES, 'claude-code.jsonl'), file);
  return file;
}

function seedCodexFixture(): string {
  const dir = join(home, '.codex', 'sessions', '2026', '08', '02');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'rollout-2026-08-02.jsonl');
  cpSync(join(FIXTURES, 'codex.jsonl'), file);
  return file;
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'ripple-usage-test-'));
  settings = { enabled: true, agents: {} };
});

describe('usage 存储：幂等 / 聚合重建 / 清除', () => {
  it('append 按 id 去重，重复追加幂等', () => {
    const store = new UsageStore(join(home, 'usage'));
    const events = [event('a1', 's1', '2026-08-01T00:00:00Z'), event('a2', 's1', '2026-08-02T00:00:00Z')];
    expect(store.append(events)).toBe(2);
    expect(store.append(events)).toBe(0);
    expect(store.allEvents()).toHaveLength(2);
  });

  it('跨月分片 + stats 缓存损坏后由明细重建', () => {
    const store = new UsageStore(join(home, 'usage'));
    store.append([
      event('a1', 's1', '2026-07-15T00:00:00Z', '/proj/a'),
      event('a2', 's1', '2026-08-15T00:00:00Z', '/proj/a'),
      event('a3', 's1', '2026-08-16T00:00:00Z', '/proj/b'),
    ]);
    expect(existsSync(join(home, 'usage', 'events-2026-07.jsonl'))).toBe(true);
    expect(existsSync(join(home, 'usage', 'events-2026-08.jsonl'))).toBe(true);
    writeFileSync(join(home, 'usage', 'stats.json'), '{broken');
    const stats = store.stats();
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      skill: 's1',
      agent: 'claude-code',
      count: 3,
      first_at: '2026-07-15T00:00:00Z',
      last_at: '2026-08-16T00:00:00Z',
      projects: { '/proj/a': 2, '/proj/b': 1 },
    });
  });

  it('clear 删除全部使用数据', () => {
    const store = new UsageStore(join(home, 'usage'));
    store.append([event('a1', 's1', '2026-08-01T00:00:00Z')]);
    store.saveCursors({ k: { offset: 1, size: 1, mtime: 1 } });
    store.clear();
    expect(existsSync(join(home, 'usage'))).toBe(false);
    expect(store.stats()).toHaveLength(0);
  });

  it('usageEventId 稳定且区分输入', () => {
    expect(usageEventId('a', 's', 'c')).toBe(usageEventId('a', 's', 'c'));
    expect(usageEventId('a', 's', 'c')).not.toBe(usageEventId('a', 's', 'd'));
    expect(usageEventId('a', 's', 'c')).toHaveLength(16);
  });
});

describe('claude-code probe：结构化解析与增量游标', () => {
  it('解析 Skill 工具调用为事件（含 cwd/timestamp/session）', async () => {
    seedClaudeFixture();
    const collector = makeCollector();
    const summary = await collector.scanAll();
    expect(summary.added).toBe(2);
    const events = collector.store.allEvents();
    expect(events.map((e) => e.skill).sort()).toEqual(['demo-deploy', 'demo-review']);
    expect(events[0]).toMatchObject({
      agent: 'claude-code',
      session_id: 'sess-0001',
      project_dir: '/proj/alpha',
      evidence: 'tool-call',
      occurred_at: '2026-08-01T10:00:05.000Z',
    });
  });

  it('增量续读：追加后二扫只出新增事件', async () => {
    const file = seedClaudeFixture();
    const collector = makeCollector();
    await collector.scanAll();
    const second = await collector.scanAll();
    expect(second.added).toBe(0);
    appendFileSync(
      file,
      JSON.stringify({
        type: 'assistant',
        sessionId: 'sess-0001',
        cwd: '/proj/alpha',
        timestamp: '2026-08-01T11:00:00.000Z',
        uuid: 'u-9',
        message: { content: [{ type: 'tool_use', id: 'toolu_new', name: 'Skill', input: { skill: 'demo-deploy' } }] },
      }) + '\n',
    );
    const third = await collector.scanAll();
    expect(third.added).toBe(1);
    expect(collector.store.allEvents()).toHaveLength(3);
  });

  it('截断/替换（size 变小）从头重扫且幂等', async () => {
    const file = seedClaudeFixture();
    const collector = makeCollector();
    await collector.scanAll();
    // 用前两行重写文件（size 变小，保留其中 1 条 Skill 调用）
    const lines = readFileSync(file, 'utf8').trim().split('\n');
    writeFileSync(file, lines.slice(0, 2).join('\n') + '\n');
    const rescan = await collector.scanAll();
    expect(rescan.added).toBe(0); // 同 id 事件已存在，不重复计数
    expect(collector.store.allEvents()).toHaveLength(2);
  });
});

describe('codex probe：路径启发式与白名单', () => {
  it('仅保留 SSOT 已知技能，evidence 为 path-heuristic', async () => {
    seedCodexFixture();
    const collector = makeCollector();
    const summary = await collector.scanAll();
    expect(summary.added).toBe(1);
    const events = collector.store.allEvents();
    expect(events[0]).toMatchObject({
      skill: 'demo-deploy',
      agent: 'codex',
      evidence: 'path-heuristic',
      occurred_at: '2026-08-02T09:01:00.000Z',
    });
    expect(events.some((e) => e.skill === 'not-installed-skill')).toBe(false);
  });
});

describe('opencode probe：sqlite loader 注入', () => {
  it('loader 不可用时 probe 标记 unavailable 被跳过，其余 probe 正常', async () => {
    seedClaudeFixture();
    const failingLoader = () => Promise.reject(new Error('no sqlite'));
    const { claudeCodeProbe } = await import('./probe-claude-code.js');
    const collector = makeCollector({ probes: [claudeCodeProbe, createOpencodeProbe(failingLoader)] });
    const summary = await collector.scanAll();
    expect(summary.added).toBe(2);
    const opencodeSource = summary.sources.find((s) => s.agent === 'opencode');
    expect(opencodeSource?.error).toBe('unavailable');
  });

  it('可用时解析 skill 工具调用并推进时间水位（fixture db）', async () => {
    let sqlite: SqliteModule;
    try {
      sqlite = (await import('node:sqlite')) as unknown as SqliteModule;
    } catch {
      return; // 本机 Node 不支持则跳过（CI Node ≥ 22 会执行）
    }
    const dbDir = join(home, '.local', 'share', 'opencode');
    mkdirSync(dbDir, { recursive: true });
    const dbPath = join(dbDir, 'opencode.db');
    const db = new sqlite.DatabaseSync(dbPath);
    const raw = db as unknown as { exec(sql: string): void };
    raw.exec(`CREATE TABLE session (id TEXT PRIMARY KEY, directory TEXT, time_created INTEGER);
      CREATE TABLE part (id TEXT PRIMARY KEY, session_id TEXT, data TEXT, time_created INTEGER);
      INSERT INTO session VALUES ('ses_1', '/proj/gamma', 1000);
      INSERT INTO part VALUES ('prt_1', 'ses_1', '{"type":"tool","tool":"skill","state":{"input":{"name":"demo-review"}}}', 2000);
      INSERT INTO part VALUES ('prt_2', 'ses_1', '{"type":"tool","tool":"bash","state":{}}', 3000);`);
    db.close();
    const collector = makeCollector({ probes: [createOpencodeProbe()] });
    const summary = await collector.scanAll();
    expect(summary.added).toBe(1);
    expect(collector.store.allEvents()[0]).toMatchObject({
      skill: 'demo-review',
      agent: 'opencode',
      session_id: 'ses_1',
      project_dir: '/proj/gamma',
      evidence: 'tool-call',
    });
    // 水位推进：二扫无新增
    const second = await collector.scanAll();
    expect(second.added).toBe(0);
    const cursors = collector.store.loadCursors();
    expect(cursors[`opencode:${dbPath}`]).toMatchObject({ watermark: 2000 });
  });
});

describe('采集开关语义（隐私边界）', () => {
  it('enabled=false 时不读任何证据文件、不产生数据目录', async () => {
    seedClaudeFixture();
    settings = { enabled: false, agents: {} };
    const collector = makeCollector();
    const summary = await collector.scanAll();
    expect(summary.added).toBe(0);
    expect(summary.sources).toHaveLength(0);
    expect(existsSync(join(home, '.ripple', 'usage'))).toBe(false);
  });

  it('agents[id]=false 单独禁用该 Agent', async () => {
    seedClaudeFixture();
    seedCodexFixture();
    settings = { enabled: true, agents: { codex: false } };
    const collector = makeCollector();
    const summary = await collector.scanAll();
    expect(summary.added).toBe(2); // 仅 claude-code
    expect(summary.sources.some((s) => s.agent === 'codex')).toBe(false);
  });
});

describe('hermes probe：skill_view 结构化证据', () => {
  const toolLine = (skill: string, callId: string, ts = '2026-05-12T13:20:00'): string =>
    JSON.stringify({
      role: 'tool',
      name: 'skill_view',
      tool_call_id: callId,
      timestamp: ts,
      content: JSON.stringify({ success: true, name: skill }),
    });

  function writeSession(name: string, lines: string[]): string {
    const dir = join(home, '.hermes', 'sessions');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, name);
    writeFileSync(file, lines.join('\n') + '\n');
    return file;
  }

  it('识别 skill_view 成功结果；meta/失败/非 skill_view 不计', async () => {
    writeSession('20260512_131425_ab.jsonl', [
      JSON.stringify({ role: 'session_meta', tools: [{ function: { name: 'skill_view' } }], timestamp: 'x' }),
      toolLine('trace-id-diagnosis', 'call_1'),
      JSON.stringify({ role: 'tool', name: 'skill_view', tool_call_id: 'call_2', content: JSON.stringify({ success: false, name: 'nope' }) }),
      JSON.stringify({ role: 'tool', name: 'terminal', tool_call_id: 'call_3', content: '{}' }),
    ]);
    const { hermesProbe } = await import('./probe-hermes.js');
    const collector = makeCollector({ probes: [hermesProbe] });
    const summary = await collector.scanAll();
    expect(summary.added).toBe(1);
    const stats = collector.stats('trace-id-diagnosis');
    expect(stats[0]).toMatchObject({ agent: 'hermes', count: 1 });
  });

  it('增量续读：追加后二扫只出新事件；重扫幂等', async () => {
    const file = writeSession('20260513_101010_cd.jsonl', [toolLine('demo-deploy', 'call_a')]);
    const { hermesProbe } = await import('./probe-hermes.js');
    const collector = makeCollector({ probes: [hermesProbe] });
    expect((await collector.scanAll()).added).toBe(1);
    appendFileSync(file, toolLine('demo-review', 'call_b') + '\n');
    expect((await collector.scanAll()).added).toBe(1);
    expect((await collector.scanAll()).added).toBe(0);
  });
});

describe('deepseek-harness probe：zstd 多帧与白名单', () => {
  const zstdCompress = async (): Promise<((b: Buffer) => Buffer) | null> => {
    const zlib = await import('node:zlib');
    const fn = (zlib as unknown as { zstdCompressSync?: (b: Buffer) => Buffer }).zstdCompressSync;
    return typeof fn === 'function' ? fn : null;
  };

  it('inflateZstdFrames（纯 JS fzstd）解出全部帧', async () => {
    const compress = await zstdCompress();
    if (!compress) return; // 测试环境 Node 无 zstd 压缩端时跳过（解压端 fzstd 恒可用）
    const { inflateZstdFrames } = await import('./probe-dsh.js');
    const f1 = compress(Buffer.from('line-one\n'));
    const f2 = compress(Buffer.from('line-two\n'));
    const text = await inflateZstdFrames(Buffer.concat([f1, f2]));
    expect(text).toBe('line-one\nline-two\n');
  });

  it('会话解析：白名单过滤、cwd/time 关联；未变更跳过重扫', async () => {
    const compress = await zstdCompress();
    if (!compress) return;
    const dir = join(home, '.dsh', 'sessions', '--proj--', 'session-1234');
    mkdirSync(dir, { recursive: true });
    const lines = [
      JSON.stringify({ type: 'session', id: 'session-1234', createdAt: 1786672930675, cwd: '/var/www/proj' }),
      JSON.stringify({ type: 'tool/result', time: 1786673700293, data: { output: 'cat /home/u/.agents/skills/demo-deploy/SKILL.md' } }),
      JSON.stringify({ type: 'tool/result', time: 1786673700300, data: { output: 'cat skills/unknown-skill/SKILL.md' } }),
    ];
    const frames = lines.map((l) => compress(Buffer.from(l + '\n')));
    writeFileSync(join(dir, 'session.jsonl.zstd'), Buffer.concat(frames));
    const { dshProbe } = await import('./probe-dsh.js');
    const collector = makeCollector({ probes: [dshProbe] });
    const summary = await collector.scanAll();
    expect(summary.added).toBe(1);
    const stats = collector.stats('demo-deploy');
    expect(stats[0]).toMatchObject({ agent: 'deepseek-harness', count: 1 });
    expect(stats[0]!.projects['/var/www/proj']).toBe(1);
    // 未变更：二扫零新增且跳过（files 仍计数，added 0）
    const again = await collector.scanAll();
    expect(again.added).toBe(0);
  });

  it('available 恒为 true（纯 JS 解码器无运行时约束）', async () => {
    const { dshProbe } = await import('./probe-dsh.js');
    expect(dshProbe.available()).toBe(true);
  });
});

describe('usage-insights-v2：明细与会话查询', () => {
  function seed(store: UsageStore): void {
    const ev = (skill: string, session: string, at: string, agent = 'claude-code', proj = '/p1'): UsageEvent => ({
      id: usageEventId(agent, session, `${skill}@${at}`),
      skill,
      agent,
      session_id: session,
      project_dir: proj,
      occurred_at: at,
      evidence: 'tool-call',
      source_file: '/x',
    });
    store.append([
      ev('foo', 's1', '2026-08-01T10:00:00Z'),
      ev('foo', 's1', '2026-08-01T11:00:00Z'),
      ev('bar', 's1', '2026-08-01T11:30:00Z'),
      ev('foo', 's2', '2026-08-02T09:00:00Z', 'codex', '/p2'),
    ]);
  }

  it('events：过滤 + 倒序 + limit', () => {
    const store = new UsageStore(join(home, '.ripple', 'usage'));
    seed(store);
    const foo = store.events({ skill: 'foo' });
    expect(foo.map((e) => e.session_id)).toEqual(['s2', 's1', 's1']);
    expect(store.events({ skill: 'foo', limit: 1 })[0]!.agent).toBe('codex');
    expect(store.events({ agent: 'claude-code' })).toHaveLength(3);
    expect(store.events({ session_id: 's2' })).toHaveLength(1);
  });

  it('sessions：分组聚合 + 技能分布 + 按最近活动倒序 + skill 过滤', () => {
    const store = new UsageStore(join(home, '.ripple', 'usage'));
    seed(store);
    const all = store.sessions();
    expect(all.map((s) => s.session_id)).toEqual(['s2', 's1']);
    const s1 = all.find((s) => s.session_id === 's1')!;
    expect(s1).toMatchObject({ agent: 'claude-code', project_dir: '/p1', count: 3 });
    expect(s1.skills).toEqual({ foo: 2, bar: 1 });
    expect(s1.first_at).toBe('2026-08-01T10:00:00Z');
    expect(s1.last_at).toBe('2026-08-01T11:30:00Z');
    // skill 过滤：只统计该技能的次数
    const fooSessions = store.sessions({ skill: 'foo' });
    expect(fooSessions).toHaveLength(2);
    expect(fooSessions.find((s) => s.session_id === 's1')!.skills).toEqual({ foo: 2 });
  });
});

describe('usage-quality-signals：触发标注 / 跟随事件 / 质量聚合', () => {
  it('claude-code：auto/manual 区分与 references 跟随；跟随不计使用次数', async () => {
    const dir = join(home, '.claude', 'projects', '-proj');
    mkdirSync(dir, { recursive: true });
    const lines = [
      JSON.stringify({ type: 'assistant', sessionId: 's1', cwd: '/p', timestamp: '2026-09-01T10:00:00Z', uuid: 'u1',
        message: { content: [{ type: 'tool_use', id: 't1', name: 'Skill', input: { skill: 'demo-deploy' } }] } }),
      JSON.stringify({ type: 'user', sessionId: 's1', cwd: '/p', timestamp: '2026-09-01T10:05:00Z', uuid: 'u2',
        message: { content: '<command-name>/demo-deploy</command-name>' } }),
      JSON.stringify({ type: 'user', sessionId: 's1', cwd: '/p', timestamp: '2026-09-01T10:06:00Z', uuid: 'u3',
        message: { content: '<command-name>/unknown-cmd</command-name>' } }),
      JSON.stringify({ type: 'assistant', sessionId: 's1', cwd: '/p', timestamp: '2026-09-01T10:10:00Z', uuid: 'u4',
        message: { content: [{ type: 'tool_use', id: 't2', name: 'Read', input: { file_path: '/home/u/.agents/skills/demo-deploy/references/guide.md' } }] } }),
    ];
    writeFileSync(join(dir, 's1.jsonl'), lines.join('\n') + '\n');
    const { claudeCodeProbe } = await import('./probe-claude-code.js');
    const collector = makeCollector({ probes: [claudeCodeProbe] });
    await collector.scanAll();
    const events = collector.events({ skill: 'demo-deploy' });
    expect(events.filter((e) => e.trigger === 'auto')).toHaveLength(1);
    expect(events.filter((e) => e.trigger === 'manual')).toHaveLength(1);
    expect(events.filter((e) => e.resource === 'reference')).toHaveLength(1);
    // 未知命令名不产事件；使用次数只计触发（2）
    expect(collector.stats('demo-deploy')[0]!.count).toBe(2);
  });

  it('qualitySignals：触发失灵 / 淘汰候选（从未使用）/ 死重 references / 共现与重复加载', () => {
    const store = new UsageStore(join(home, '.ripple', 'usage'));
    const ev = (skill: string, session: string, at: string, extra: Partial<UsageEvent> = {}): UsageEvent => ({
      id: usageEventId('claude-code', session, `${skill}@${at}@${JSON.stringify(extra)}`),
      skill, agent: 'claude-code', session_id: session, project_dir: '/p',
      occurred_at: at, evidence: 'tool-call', source_file: '/x', ...extra,
    });
    const now = new Date('2026-09-03T00:00:00Z');
    store.append([
      // hot：6 次触发 4 manual → 触发失灵；s1 内重复加载；与 buddy 共现
      ev('hot', 's1', '2026-09-01T01:00:00Z', { trigger: 'manual' }),
      ev('hot', 's1', '2026-09-01T02:00:00Z', { trigger: 'manual' }),
      ev('hot', 's2', '2026-09-01T03:00:00Z', { trigger: 'manual' }),
      ev('hot', 's3', '2026-09-01T04:00:00Z', { trigger: 'manual' }),
      ev('hot', 's4', '2026-09-01T05:00:00Z', { trigger: 'auto' }),
      ev('hot', 's5', '2026-09-01T06:00:00Z', { trigger: 'auto' }),
      ev('buddy', 's1', '2026-09-01T01:30:00Z'),
      // deadref：3 会话触发、references 从未被读
      ev('deadref', 'd1', '2026-09-01T01:00:00Z'),
      ev('deadref', 'd2', '2026-09-01T02:00:00Z'),
      ev('deadref', 'd3', '2026-09-01T03:00:00Z'),
      // followed：references 有跟随
      ev('followed', 'f1', '2026-09-01T01:00:00Z'),
      ev('followed', 'f1', '2026-09-01T01:10:00Z', { resource: 'reference' }),
    ]);
    const signals = store.qualitySignals(['hot', 'deadref', 'followed', 'never-skill'], {
      withReferences: new Set(['deadref', 'followed']),
      now,
    });
    const get = (name: string) => signals.find((s) => s.skill === name)!;
    expect(get('hot').manual_ratio).toBeCloseTo(4 / 6);
    expect(get('hot').labels).toContain('触发失灵');
    expect(get('hot').repeat_sessions).toBe(1);
    expect(get('hot').co_occurs[0]).toMatchObject({ skill: 'buddy', sessions: 1 });
    expect(get('deadref').labels).toContain('死重 references');
    expect(get('followed').labels).not.toContain('死重 references');
    expect(get('followed').reference_follow_rate).toBe(1);
    expect(get('never-skill')).toMatchObject({ never_used: true, triggers: 0 });
    expect(get('never-skill').labels).toContain('淘汰候选');
    // followed 只有 1 个会话（<3）不触发死重；无 trigger 标注 manual_ratio 为 null
    expect(get('followed').manual_ratio).toBeNull();
  });
});
