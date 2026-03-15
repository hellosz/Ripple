import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const RC_FILE = ".ripplerc";
const DEFAULT_SERVER = "http://localhost:8000";
const DEFAULT_DIR = ".skills";

/**
 * Resolve config from: CLI flags > .ripplerc > env > defaults
 */
export function getConfig(flags = {}) {
  const rc = loadRc();
  return {
    server: flags.server || rc.server || process.env.RIPPLE_SERVER || DEFAULT_SERVER,
    dir: flags.dir || rc.dir || process.env.RIPPLE_DIR || DEFAULT_DIR,
    token: flags.token || rc.token || process.env.RIPPLE_TOKEN || "",
  };
}

function loadRc() {
  // Check current dir first, then home dir
  for (const base of [process.cwd(), homedir()]) {
    const p = join(base, RC_FILE);
    if (existsSync(p)) {
      try {
        return JSON.parse(readFileSync(p, "utf-8"));
      } catch {
        return {};
      }
    }
  }
  return {};
}
