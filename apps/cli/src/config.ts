import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface CliConfigFile {
  server?: string;
  token?: string;
  default_agent?: string;
}

export interface ResolvedValue {
  value: string;
  source: 'flag' | 'env' | 'file' | 'default';
}

export const DEFAULT_SERVER = 'http://localhost:8000';

export function rcPath(homeDir: string = homedir()): string {
  return join(homeDir, '.ripplerc');
}

export function readRc(homeDir?: string): CliConfigFile {
  try {
    const raw = readFileSync(rcPath(homeDir), 'utf8');
    try {
      return JSON.parse(raw) as CliConfigFile;
    } catch {
      // 兼容旧版 KEY=VALUE 格式
      const out: CliConfigFile = {};
      for (const line of raw.split('\n')) {
        const [k, ...rest] = line.split('=');
        const v = rest.join('=').trim();
        if (!k || !v) continue;
        const key = k.trim().toLowerCase();
        if (key === 'server' || key === 'ripple_server') out.server = v;
        if (key === 'token' || key === 'ripple_token') out.token = v;
      }
      return out;
    }
  } catch {
    return {};
  }
}

export function writeRc(config: CliConfigFile, homeDir?: string): void {
  const file = rcPath(homeDir);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  try {
    chmodSync(file, 0o600);
  } catch {
    /* Windows 无 chmod 语义 */
  }
}

export interface GlobalFlags {
  server?: string;
  token?: string;
  json?: boolean;
  yes?: boolean;
}

/** 配置分层：flag > env > ~/.ripplerc > 默认值 */
export function resolveConfig(
  flags: GlobalFlags,
  env: NodeJS.ProcessEnv = process.env,
  homeDir?: string,
): { server: ResolvedValue; token: ResolvedValue } {
  const file = readRc(homeDir);
  const pick = (
    flag: string | undefined,
    envValue: string | undefined,
    fileValue: string | undefined,
    fallback: string,
  ): ResolvedValue => {
    if (flag) return { value: flag, source: 'flag' };
    if (envValue) return { value: envValue, source: 'env' };
    if (fileValue) return { value: fileValue, source: 'file' };
    return { value: fallback, source: 'default' };
  };
  return {
    server: pick(flags.server, env.RIPPLE_SERVER, file.server, DEFAULT_SERVER),
    token: pick(flags.token, env.RIPPLE_TOKEN, file.token, ''),
  };
}
