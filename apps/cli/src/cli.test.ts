import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';

const cliDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const binPath = join(cliDir, 'dist', 'index.js');

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

let home: string;

function run(args: string[], opts: { env?: Record<string, string> } = {}): RunResult {
  const result = spawnSync('node', [binPath, ...args], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH ?? '',
      HOME: home,
      USERPROFILE: home,
      ...opts.env,
    },
  });
  return { code: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

const SKILL_MD = `---
name: offline-demo
description: 离线安装集成测试用技能，描述长度满足要求即可，不追求评级。
version: 2.5.0
---

# offline-demo

## Usage
测试
`;

beforeAll(() => {
  execFileSync('npx', ['tsup'], { cwd: cliDir, stdio: 'ignore' });
  home = mkdtempSync(join(tmpdir(), 'ripple-cli-test-'));
  mkdirSync(join(home, '.claude'));
}, 120_000);

describe('退出码约定', () => {
  it('--help 退出码 0', () => {
    expect(run(['--help']).code).toBe(0);
  });

  it('未知参数退出码 2，用法提示走 stderr', () => {
    const r = run(['install', '--no-such-flag']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('unknown option');
    expect(r.stdout).toBe('');
  });

  it('未知命令退出码 2', () => {
    expect(run(['frobnicate']).code).toBe(2);
  });

  it('业务失败退出码 1', () => {
    const r = run(['--yes', 'uninstall', 'ghost-skill']);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('错误');
  });
});

describe('非交互破坏性操作', () => {
  it('无 --yes 拒绝执行（退出码 1）', () => {
    const r = run(['uninstall', 'anything']);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('--yes');
  });
});

describe('配置分层', () => {
  it('env 覆盖 rc 文件，flag 覆盖 env', () => {
    writeFileSync(
      join(home, '.ripplerc'),
      JSON.stringify({ server: 'http://from-file.local' }),
    );
    const fromFile = JSON.parse(run(['--json', 'config', 'get']).stdout) as {
      server: { value: string; source: string };
    };
    expect(fromFile.server).toMatchObject({ value: 'http://from-file.local', source: 'file' });

    const fromEnv = JSON.parse(
      run(['--json', 'config', 'get'], { env: { RIPPLE_SERVER: 'http://from-env.local' } })
        .stdout,
    ) as { server: { value: string; source: string } };
    expect(fromEnv.server).toMatchObject({ value: 'http://from-env.local', source: 'env' });

    const fromFlag = JSON.parse(
      run(['--json', '--server', 'http://from-flag.local', 'config', 'get'], {
        env: { RIPPLE_SERVER: 'http://from-env.local' },
      }).stdout,
    ) as { server: { value: string; source: string } };
    expect(fromFlag.server).toMatchObject({ value: 'http://from-flag.local', source: 'flag' });
  });

  it('config set 写入 rc 文件', () => {
    expect(run(['config', 'set', 'server', 'http://set.local']).code).toBe(0);
    const got = JSON.parse(run(['--json', 'config', 'get', 'server']).stdout) as {
      server: { value: string };
    };
    expect(got.server.value).toBe('http://set.local');
  });

  it('不支持的配置项退出码 2', () => {
    expect(run(['config', 'set', 'nope', 'x']).code).toBe(2);
  });
});

describe('离线本地流（--zip 安装，无需登录）', () => {
  it('install --zip → list --installed --json → disable → uninstall → backup', () => {
    const zipFile = join(home, 'offline-demo.zip');
    writeFileSync(zipFile, zipSync({ 'SKILL.md': strToU8(SKILL_MD) }));

    const install = run(['install', 'offline-demo', '--zip', zipFile, '--agent', 'claude-code']);
    expect(install.code).toBe(0);

    const list = run(['--json', 'list', '--installed']);
    expect(list.code).toBe(0);
    const installs = JSON.parse(list.stdout) as Array<{
      skill: string;
      version: string;
      agent: string;
      enabled: boolean;
    }>;
    expect(installs).toHaveLength(1);
    expect(installs[0]).toMatchObject({
      skill: 'offline-demo',
      version: '2.5.0',
      agent: 'claude-code',
      enabled: true,
    });

    const disable = run(['--json', 'disable', 'offline-demo', '--agent', 'claude-code']);
    expect(disable.code).toBe(0);
    expect((JSON.parse(disable.stdout) as { enabled: boolean }).enabled).toBe(false);

    const uninstall = run(['--yes', 'uninstall', 'offline-demo']);
    expect(uninstall.code).toBe(0);

    const backups = JSON.parse(run(['--json', 'backup', 'list']).stdout) as Array<{
      skill: string;
    }>;
    expect(backups.some((b) => b.skill === 'offline-demo')).toBe(true);
  });

  it('--json 模式 stdout 是纯 JSON（提示走 stderr）', () => {
    const r = run(['--json', 'agent', 'list']);
    expect(r.code).toBe(0);
    const agents = JSON.parse(r.stdout) as Array<{ id: string; detected: boolean }>;
    expect(agents.find((a) => a.id === 'claude-code')?.detected).toBe(true);
  });
});

describe('来源管理', () => {
  it('add/list/remove；内置来源不可删', () => {
    expect(run(['source', 'add', 'acme/skills#dev:packs']).code).toBe(0);
    const sources = JSON.parse(run(['--json', 'source', 'list']).stdout) as Array<{
      id: string;
      branch: string;
      subdir: string;
      builtin: boolean;
    }>;
    const added = sources.find((s) => s.id === 'acme/skills');
    expect(added).toMatchObject({ branch: 'dev', subdir: 'packs', builtin: false });

    expect(run(['--yes', 'source', 'remove', 'acme/skills']).code).toBe(0);
    expect(run(['--yes', 'source', 'remove', 'anthropics/skills']).code).toBe(1);
  });
});
