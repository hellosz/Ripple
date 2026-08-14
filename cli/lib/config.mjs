import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_PATH = join(homedir(), ".ripplerc");
const DEFAULT_SERVER = "http://localhost:8000";

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return { server: DEFAULT_SERVER, token: "", email: "" };
  }
  try {
    return { server: DEFAULT_SERVER, token: "", email: "", ...JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) };
  } catch {
    return { server: DEFAULT_SERVER, token: "", email: "" };
  }
}

export function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function resolveServer(flags, config) {
  return flags.server || process.env.RIPPLE_SERVER || config?.server || DEFAULT_SERVER;
}

export function resolveToken(flags, config) {
  return flags.token || process.env.RIPPLE_TOKEN || config?.token || "";
}

export { CONFIG_PATH };
