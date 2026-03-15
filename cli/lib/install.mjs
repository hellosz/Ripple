import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { Buffer } from "node:buffer";
import { apiBuffer, apiJson } from "./api.mjs";

/**
 * Download and extract a skill into the target directory.
 */
export async function install(name, config) {
  console.log(`\n  Installing ${name} ...`);

  // 1. Fetch skill info to confirm it exists
  let skill;
  try {
    skill = await apiJson(`/skills/${name}`, config);
  } catch (err) {
    throw new Error(`Skill "${name}" not found (${err.message})`);
  }

  console.log(`  ${skill.display_name} v${skill.version}  [${skill.rating}]`);

  // 2. Download the ZIP
  let zipBuf;
  try {
    zipBuf = await apiBuffer(`/skills/${name}/download`, config);
  } catch {
    // If auth required, try to get files via public API instead
    console.log("  Download requires auth, fetching files via public API...");
    await installViaFiles(name, config);
    return;
  }

  // 3. Extract ZIP (using built-in decompress)
  const targetDir = join(process.cwd(), config.dir, name);
  await extractZip(zipBuf, targetDir, name);

  console.log(`  Installed to ${config.dir}/${name}/`);
  console.log();
}

/**
 * Fallback: fetch file tree and contents individually.
 */
async function installViaFiles(name, config) {
  const files = await apiJson(`/skills/${name}/files`, config);
  const targetDir = join(process.cwd(), config.dir, name);

  const allFiles = flattenTree(files, "");
  let count = 0;

  for (const filePath of allFiles) {
    const content = await apiJson(`/skills/${name}/files/${filePath}`, config);
    const dest = join(targetDir, filePath);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content.content, "utf-8");
    count++;
  }

  console.log(`  Installed ${count} file(s) to ${config.dir}/${name}/`);
  console.log();
}

function flattenTree(nodes, prefix) {
  const result = [];
  for (const node of nodes) {
    const p = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === "file") {
      result.push(p);
    } else if (node.children) {
      result.push(...flattenTree(node.children, p));
    }
  }
  return result;
}

/**
 * Minimal ZIP extractor using Node.js built-in zlib.
 * Handles the most common ZIP format (deflate + stored).
 */
async function extractZip(buf, targetDir, skillName) {
  // Use the decompress-zip approach with raw buffer parsing
  let offset = 0;
  let fileCount = 0;
  const prefix = `${skillName}/`;

  while (offset < buf.length - 4) {
    // Local file header signature = 0x04034b50
    const sig = buf.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;

    const method = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const uncompSize = buf.readUInt32LE(offset + 22);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const nameBytes = buf.subarray(offset + 30, offset + 30 + nameLen);
    let fileName = nameBytes.toString("utf-8");

    // Strip the skill-name prefix from ZIP paths
    if (fileName.startsWith(prefix)) {
      fileName = fileName.slice(prefix.length);
    }

    const dataStart = offset + 30 + nameLen + extraLen;
    const rawData = buf.subarray(dataStart, dataStart + compSize);

    offset = dataStart + compSize;

    // Skip directories
    if (fileName.endsWith("/") || !fileName) continue;

    let content;
    if (method === 0) {
      // Stored
      content = rawData;
    } else if (method === 8) {
      // Deflate
      const { inflateRawSync } = await import("node:zlib");
      content = inflateRawSync(rawData);
    } else {
      console.warn(`  Skipping ${fileName} (unsupported compression method ${method})`);
      continue;
    }

    const dest = join(targetDir, fileName);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content);
    fileCount++;
  }

  if (fileCount === 0) {
    throw new Error("Failed to extract ZIP — no files found");
  }

  console.log(`  Extracted ${fileCount} file(s)`);
}
