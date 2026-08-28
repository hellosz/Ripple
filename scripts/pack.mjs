#!/usr/bin/env node
/**
 * 本地打包工具（不上传 npm / 不发 Release）：
 *   pnpm pack:cli               → artifacts/hellosz-ripple-<version>.tgz（npm i -g 即装）
 *   pnpm pack:cli --install     → 打包后直接全局安装
 *   pnpm pack:desktop           → 当前平台安装包（Linux: AppImage+deb / macOS: dmg+zip / Windows: nsis）
 *   pnpm pack:desktop --install → 打包后直接安装（Linux: sudo dpkg -i；macOS: 打开 dmg）；
 *                                 产物哈希与上次安装一致时自动跳过安装（--force 强制重装）
 *   pnpm pack:desktop --install --skip-build → 不重新构建，直接安装 release/ 现有产物
 *   pnpm pack                   → 两者都打
 * 产物统一收进根级 artifacts/，输出大小与 sha256 清单。
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const artifactsDir = join(root, 'artifacts');
mkdirSync(artifactsDir, { recursive: true });

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--')) ?? 'all';
const doInstall = args.includes('--install');
const skipBuild = args.includes('--skip-build');
const force = args.includes('--force');
const installedMarker = join(artifactsDir, '.desktop-pack.json');

/** 目录内容哈希（递归、按路径排序；electron-vite 产物确定性，可代表"构建输入是否变化"） */
function hashDir(dir) {
  const h = createHash('sha256');
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else h.update(full.slice(dir.length)).update('\0').update(readFileSync(full)).update('\0');
    }
  };
  walk(dir);
  return h.digest('hex');
}

function readMarker() {
  try {
    return JSON.parse(readFileSync(installedMarker, 'utf8'));
  } catch {
    return {};
  }
}

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
  const marker = readMarker();
  let inputSha = null;
  if (skipBuild) {
    console.log('\n▶ 跳过构建，使用 release/ 现有产物');
  } else {
    console.log('\n▶ 构建（electron-vite）');
    run('pnpm --dir apps/desktop build');
    const cfgSha = sha256(join(root, 'apps/desktop/electron-builder.yml'));
    const pkgSha = sha256(join(root, 'apps/desktop/package.json'));
    inputSha = createHash('sha256')
      .update(hashDir(join(root, 'apps/desktop/out')))
      .update(cfgSha)
      .update(pkgSha)
      .digest('hex');
    const debExists = readdirSync(artifactsDir).some((f) => f.endsWith('.deb') || f.endsWith('.dmg') || f.endsWith('.exe'));
    if (!force && inputSha === marker.inputSha && debExists) {
      console.log('▶ 构建输入未变化（代码/配置与上次打包一致），跳过 electron-builder');
      if (doInstall && marker.installed) {
        console.log('▶ 该版本已安装过，跳过安装（--force 强制重打重装）');
        return;
      }
    } else {
      console.log('▶ 打包（electron-builder，unsigned，--publish never）');
      run('pnpm --dir apps/desktop exec electron-builder --publish never');
      // 打包即记录构建输入指纹（是否安装另行标记）
      writeFileSync(
        installedMarker,
        JSON.stringify({ ...marker, inputSha, installed: marker.inputSha === inputSha ? marker.installed : false }),
      );
    }
  }
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
      const debSha = sha256(deb);
      if (!force && debSha === marker.debSha) {
        console.log('\n▶ 该 deb 已安装过（sha256 一致），跳过安装（--force 强制重装）');
      } else {
        console.log('\n▶ 安装（需要 sudo 密码）');
        run(`sudo dpkg -i "${deb}"`);
        writeFileSync(
          installedMarker,
          JSON.stringify({ inputSha: inputSha ?? marker.inputSha ?? null, debSha, installed: true }),
        );
        console.log('已安装：ripple-desktop');
      }
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
