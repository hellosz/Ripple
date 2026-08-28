import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { HubState } from './types.js';

export function defaultState(): HubState {
  return {
    schema_version: 1,
    storage_location: 'shared',
    dist_mode: 'symlink',
    default_agent: 'claude-code',
    installs: [],
    projects: [],
    sources: [
      {
        id: 'anthropics/skills',
        owner: 'anthropics',
        repo: 'skills',
        branch: 'main',
        subdir: '',
        note: '官方技能仓库',
        builtin: true,
      },
    ],
    history: {},
    backups: [],
    owned: {},
    oplog: [],
    scenarios: {},
  };
}

export function stateFilePath(rippleDir: string): string {
  return join(rippleDir, 'state.json');
}

export function loadState(rippleDir: string): HubState {
  try {
    const raw = readFileSync(stateFilePath(rippleDir), 'utf8');
    const parsed = JSON.parse(raw) as HubState;
    if (parsed.schema_version !== 1) return defaultState();
    // 补齐缺失字段（前向兼容）
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

/** 原子写：临时文件 + rename，断电不会留下半写文件 */
export function saveState(rippleDir: string, state: HubState): void {
  const file = stateFilePath(rippleDir);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  renameSync(tmp, file);
}
