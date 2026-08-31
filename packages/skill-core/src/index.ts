// @ripple/skill-core — SKILL.md 解析/校验/评级（server 与本地端共享）
export * from './frontmatter.js';
export * from './zip.js';
export * from './files.js';
export * from './rating.js';
export * from './ai/estimate.js';
export * from './ai/parse.js';
export * from './ai/aggregate.js';
export * from './ai/input.js';
export * from './ai/prompts.js';

/** 安装命令（新 CLI：npm 包名 ripple） */
export function buildInstallCommand(skillName: string): string {
  return `ripple install ${skillName}`;
}
