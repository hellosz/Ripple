#!/usr/bin/env node
/**
 * 本地打包工具（不上传 npm / 不发 Release）：
 *   pnpm pack:cli               → artifacts/hellosz-ripple-<version>.tgz（npm i -g 即装）
 *   pnpm pack:cli --install     → 打包后直接全局安装
 *   pnpm pack:desktop           → 当前平台安装包（Linux: AppImage+deb / macOS: dmg+zip / Windows: nsis）
 *   pnpm pack:desktop --install → 打包后直接安装（Linux: sudo dpkg -i；macOS: 打开 dmg）
 *   pnpm pack                   → 两者都打
 * 产物统一收进根级 artifacts/，输出大小与 sha256 清单。
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const artifactsDir = join(root, 'artifacts');
mkdirSync(artifactsDir, { recursive: true });

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--')) ?? 'all';
const doInstall = args.includes('--install');

const run = (cmd) => execSync(cmd, { stdio: 'inherit', cwd: root });
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const produced = [];

function collect(dir, patterns) {
  for (const name of readdirSync(dir)) {
    if (!patterns.some((re) => re.test(name))) continue;
    const src = join(dir, name);
    if (!statSync(src).isFile()) continue;
    const dest = join(artifactsDir, name);
    copyFileSync(src, dest);
    produced.push(dest);
  }
}

function packCli() {
  console.log('\n▶ 打包 CLI（tsup 单文件 → npm tgz）');
  run('pnpm --dir apps/cli build');
  run(`pnpm --dir apps/cli pack --pack-destination ${artifactsDir}`);
  const version = JSON.parse(readFileSync(join(root, 'apps/cli/package.json'), 'utf8')).version;
  const tgz = readdirSync(artifactsDir)
    .filter((f) => f.endsWith(`${version}.tgz`))
    .map((f) => join(artifactsDir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  if (!tgz) throw new Error('未找到 tgz 产物');
  produced.push(tgz);
  if (doInstall) {
    console.log('\n▶ 全局安装本地包');
    run(`npm i -g "${tgz}"`);
    run('ripple --version');
  } else {
    console.log(`\n安装：npm i -g "${tgz}"`);
  }
}

function packDesktop() {
  console.log('\n▶ 打包桌面（当前平台，unsigned，--publish never）');
  run('pnpm --dir apps/desktop build');
  run('pnpm --dir apps/desktop exec electron-builder --publish never');
  collect(join(root, 'apps/desktop/release'), [
    /\.AppImage$/,
    /\.deb$/,
    /\.dmg$/,
    /-mac\.zip$/,
    /\.exe$/,
    /^latest.*\.yml$/,
  ]);
  if (doInstall) {
    const find = (re) => produced.find((f) => re.test(f));
    if (process.platform === 'linux') {
      const deb = find(/\.deb$/);
      if (!deb) throw new Error('未找到 deb 产物');
      console.log('\n▶ 安装（需要 sudo 密码）');
      run(`sudo dpkg -i "${deb}"`);
      console.log('已安装：ripple-desktop');
    } else if (process.platform === 'darwin') {
      const dmg = find(/\.dmg$/);
      if (dmg) {
        console.log('\n▶ macOS 无法静默安装，已打开 DMG，请拖入 Applications');
        run(`open "${dmg}"`);
      }
    } else {
      const exe = find(/\.exe$/);
      if (exe) run(`"${exe}"`);
    }
  }
}

if (target === 'cli' || target === 'all') packCli();
if (target === 'desktop' || target === 'all') packDesktop();
if (!['cli', 'desktop', 'all'].includes(target)) {
  console.error(`未知目标：${target}（可选 cli / desktop / all）`);
  process.exit(2);
}

console.log('\n== artifacts/ 产物清单 ==');
for (const file of [...new Set(produced)]) {
  const size = (statSync(file).size / 1024 / 1024).toFixed(1);
  console.log(`${file.split('/').pop()}  ${size}MB  sha256:${sha256(file).slice(0, 16)}…`);
}
