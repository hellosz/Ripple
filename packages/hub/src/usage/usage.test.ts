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
