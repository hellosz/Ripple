/**
 * Agent target directory mapping.
 * Each entry maps a CLI --target value to the skills directory used by that agent.
 */
export const AGENTS = {
  claude: { dir: ".claude/skills", label: "Claude Code" },
  codex: { dir: ".codex/skills", label: "OpenAI Codex" },
  cursor: { dir: ".cursor/skills", label: "Cursor" },
};

export const DEFAULT_DIR = ".skills";

export function listAgents() {
  return [
    ["skills", DEFAULT_DIR, "Generic (.skills)"],
    ...Object.entries(AGENTS).map(([key, v]) => [key, v.dir, v.label]),
  ];
}

export function resolveTargetDir({ target, dir }) {
  if (dir) return dir;
  if (target && AGENTS[target]) return AGENTS[target].dir;
  if (target === "skills" || !target) return DEFAULT_DIR;
  throw new Error(
    `未知的 --target "${target}"。可用: skills, ${Object.keys(AGENTS).join(", ")}`
  );
}
