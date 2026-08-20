import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentAdapter, DetectedAgent } from './types.js';

/** 声明式适配器注册表：新增 Agent 只需添加条目 */
export const AGENT_ADAPTERS: AgentAdapter[] = [
  { id: 'claude-code', name: 'Claude Code', globalRelPath: '.claude/skills', projectRelPath: '.claude/skills' },
  { id: 'codex', name: 'Codex', globalRelPath: '.codex/skills', projectRelPath: '.codex/skills' },
  { id: 'opencode', name: 'OpenCode', globalRelPath: '.opencode/skill', projectRelPath: '.opencode/skill' },
  { id: 'cursor', name: 'Cursor', globalRelPath: '.cursor/skills', projectRelPath: '.cursor/skills' },
  { id: 'hermes', name: 'Hermes', globalRelPath: '.hermes/skills', projectRelPath: '.hermes/skills' },
  {
    id: 'deepseek-harness',
    name: 'DeepSeek Harness',
    globalRelPath: '.deepseek/harness/skills',
    projectRelPath: '.deepseek/harness/skills',
  },
  { id: 'openclaw', name: 'OpenClaw', globalRelPath: '.openclaw/skills', projectRelPath: '.openclaw/skills' },
  { id: 'pi', name: 'Pi', globalRelPath: '.pi/skills', projectRelPath: '.pi/skills' },
];

export function getAdapter(id: string): AgentAdapter | undefined {
  return AGENT_ADAPTERS.find((a) => a.id === id);
}

/** 检测本机 Agent：判断其全局目录的父目录是否存在（如 ~/.claude/） */
export function detectAgents(homeDir: string): DetectedAgent[] {
  return AGENT_ADAPTERS.map((adapter) => {
    const globalPath = join(homeDir, adapter.globalRelPath);
    const agentRoot = join(homeDir, adapter.globalRelPath.split('/')[0] ?? '');
    return {
      ...adapter,
      globalPath,
      detected: existsSync(agentRoot),
    };
  });
}

export function agentTargetDir(
  homeDir: string,
  adapter: AgentAdapter,
  projectDir?: string,
): string {
  return projectDir ? join(projectDir, adapter.projectRelPath) : join(homeDir, adapter.globalRelPath);
}
