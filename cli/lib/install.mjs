import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  rmSync,
  existsSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { apiBuffer, apiJson } from "./api.mjs";
import { resolveTargetDir } from "./agents.mjs";

/**
 * Download and extract a skill into the target agent directory.
 */
export async function install(name, config, opts = {}) {
  const targetDir = resolveTargetDir(opts);
  const info = await apiJson(`/skills/${name}`, config);

  console.log(`\n→ 安装 ${info.display_name} v${info.version} [${info.rating}]`);
  console.log(`  目标: ${targetDir}/${name}/`);

  const zip = await apiBuffer(`/skills/${name}/download`, config);
  const tmp = join(
    tmpdir(),
    `ripple-${Date.now()}-${Math.random().toString(16).slice(2)}.zip`
  );
  writeFileSync(tmp, zip);
  try {
    mkdirSync(join(process.cwd(), targetDir), { recursive: true });
    execFileSync("unzip", ["-oq", tmp, "-d", join(process.cwd(), targetDir)]);
  } finally {
    unlinkSync(tmp);
  }

  console.log(`✓ 已安装到 ${targetDir}/${name}/\n`);
}

/**
 * Update reuses install (re-download and overwrite).
 */
export async function update(name, config, opts = {}) {
  const targetDir = resolveTargetDir(opts);
  const dest = join(process.cwd(), targetDir, name);
  console.log(existsSync(dest) ? `→ 更新 ${name} ...` : `→ 安装 ${name} ...`);
  await install(name, config, opts);
}

/**
 * Delete a locally installed skill directory.
 */
export async function remove(name, opts = {}) {
  const targetDir = resolveTargetDir(opts);
  const dest = join(process.cwd(), targetDir, name);
  if (!existsSync(dest)) {
    console.log(`未找到 ${dest}，无需删除`);
    return;
  }
  rmSync(dest, { recursive: true, force: true });
  console.log(`✓ 已删除 ${dest}\n`);
}
