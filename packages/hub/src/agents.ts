import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentAdapter, DetectedAgent } from './types.js';

/** 声明式适配器注册表：新增 Agent 只需添加条目 */
export const AGENT_ADAPTERS: AgentAdapter[] = [
  // 固定展示顺序；sharedDirSupport = 该 Agent 默认读取 home 级 ~/.agents/skills（2026-08 官方文档逐一核实）：
  // - claude-code: 官方文档零处提及 .agents/skills，仅 ~/.claude/skills 与项目 .claude/skills → false
  // - codex: $HOME/.agents/skills 即其用户级主目录（developers.openai.com/codex/skills）→ true
  // - opencode: 原生读 ~/.agents/skills，兼容 .claude（opencode.ai/docs/skills）→ true
  // - hermes: home 级共享目录需 config skills.external_dirs 手动 opt-in，默认不读 → false（项目级 .agents/skills 默认读）
  // - openclaw: 默认扫描 ~/.agents/skills（docs.openclaw.ai/tools/skills，优先级 3）→ true
  // - pi: ~/.agents/skills 为默认全局位置之一（pi-mono skills.md）→ true；专属全局目录实为 ~/.pi/agent/skills
  // - cursor: 官方表格明列 ~/.agents/skills = User-level global（cursor.com/docs/skills）→ true
  // - deepseek-harness: <agentsHome>/skills rank 500（deepseek-harness skills 子系统文档）→ true；专属目录实为 ~/.dsh/skills
  { id: 'claude-code', name: 'Claude Code', globalRelPath: '.claude/skills', projectRelPath: '.claude/skills', sharedDirSupport: false },
  { id: 'codex', name: 'Codex', globalRelPath: '.codex/skills', projectRelPath: '.codex/skills', sharedDirSupport: true },
  { id: 'opencode', name: 'OpenCode', globalRelPath: '.opencode/skill', projectRelPath: '.opencode/skill', sharedDirSupport: true },
  { id: 'hermes', name: 'Hermes', globalRelPath: '.hermes/skills', projectRelPath: '.hermes/skills', sharedDirSupport: false },
  { id: 'openclaw', name: 'OpenClaw', globalRelPath: '.openclaw/skills', projectRelPath: '.openclaw/skills', sharedDirSupport: true },
  { id: 'pi', name: 'Pi', globalRelPath: '.pi/agent/skills', projectRelPath: '.pi/skills', sharedDirSupport: true },
  { id: 'cursor', name: 'Cursor', globalRelPath: '.cursor/skills', projectRelPath: '.cursor/skills', sharedDirSupport: true },
  {
    id: 'deepseek-harness',
    name: 'DeepSeek Harness',
    globalRelPath: '.dsh/skills',
    projectRelPath: '.agents/skills',
    sharedDirSupport: true,
  },
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
