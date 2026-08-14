import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";

/**
 * Package a skill directory or ZIP and publish it to the platform.
 * Requires an authenticated session (ripple login first).
 */
export async function publish(skillPath, config, opts = {}) {
  if (!existsSync(skillPath)) {
    throw new Error(`路径不存在: ${skillPath}`);
  }

  let zipPath = skillPath;
  let cleanupZip = false;

  // 目录 → 打包成 zip
  if (statSync(skillPath).isDirectory()) {
    zipPath = join(tmpdir(), `ripple-publish-${Date.now()}.zip`);
    const parent = join(skillPath, "..");
    execFileSync("zip", ["-rq", zipPath, basename(skillPath)], { cwd: parent });
    cleanupZip = true;
    console.log(`→ 已打包目录: ${skillPath}`);
  }

  try {
    const form = new FormData();
    const zipBuffer = readFileSync(zipPath);
    form.append(
      "file",
      new Blob([zipBuffer], { type: "application/zip" }),
      `${basename(skillPath, ".zip")}.zip`
    );
    form.append("category", opts.category || "");
    form.append("recommendation", opts.recommendation || "");
    form.append("origin_type", opts.origin || "original");
    form.append("publish_channel", opts.channel || "production");
    if (opts.tags) form.append("tags", opts.tags);

    const headers = {};
    if (config.token) headers["Authorization"] = `Bearer ${config.token}`;

    console.log(`→ 发布到 ${config.server} ...`);
    const res = await fetch(`${config.server}/api/skills`, {
      method: "POST",
      headers,
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();

    console.log(`✓ 发布成功: ${data.name} v${data.version} [${data.rating}] [${opts.channel || "production"}]`);
    if (data.suggestions?.length) {
      console.log("\n评分建议（提升评级）:");
      for (const s of data.suggestions) console.log(`  - ${s}`);
    }
    console.log("");
  } finally {
    if (cleanupZip) unlinkSync(zipPath);
  }
}
