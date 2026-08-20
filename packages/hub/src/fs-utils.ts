import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { DistMode, EffectiveMode } from './types.js';

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function removePath(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

export function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

export function pathExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/** Windows 目录链接用 junction（无需特权）；其余平台用 dir symlink */
export function symlinkTypeFor(platform: NodeJS.Platform): 'junction' | 'dir' {
  return platform === 'win32' ? 'junction' : 'dir';
}

export function copyDir(src: string, dest: string): void {
  ensureDir(dirname(dest));
  cpSync(src, dest, { recursive: true });
}

/**
 * 把 SSOT 目录分发到目标目录。
 * symlink 模式失败自动降级 copy；返回实际生效方式。
 */
export function distribute(
  srcDir: string,
  destDir: string,
  mode: DistMode,
  platform: NodeJS.Platform = process.platform,
): EffectiveMode {
  removePath(destDir);
  ensureDir(dirname(destDir));
  if (mode === 'symlink') {
    const type = symlinkTypeFor(platform);
    try {
      symlinkSync(srcDir, destDir, type);
      return type === 'junction' ? 'junction' : 'symlink';
    } catch {
      copyDir(srcDir, destDir);
      return 'copy';
    }
  }
  copyDir(srcDir, destDir);
  return 'copy';
}

/** 递归收集目录下全部文件（相对路径 → 内容） */
export function readDirFiles(dir: string): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  const walk = (current: string, prefix: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else if (entry.isFile()) out[rel] = new Uint8Array(readFileSync(full));
    }
  };
  if (existsSync(dir)) walk(dir, '');
  return out;
}
