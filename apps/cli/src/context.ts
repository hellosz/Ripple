import { RippleClient } from '@ripple/api-client';
import { RippleHub, type InstallTarget } from '@ripple/hub';
import { resolveConfig, type GlobalFlags } from './config.js';
import { CliError, makeOutput, type OutputContext } from './output.js';

export interface CliContext {
  flags: GlobalFlags;
  out: OutputContext;
  server: string;
  token: string;
  tokenSource: string;
  client: RippleClient;
  hub: RippleHub;
}

export function buildContext(flags: GlobalFlags): CliContext {
  const resolved = resolveConfig(flags);
  const client = new RippleClient({
    baseUrl: resolved.server.value,
    getToken: () => resolved.token.value || null,
  });
  return {
    flags,
    out: makeOutput(flags),
    server: resolved.server.value,
    token: resolved.token.value,
    tokenSource: resolved.token.source,
    client,
    hub: new RippleHub(),
  };
}

export function requireToken(ctx: CliContext): void {
  if (!ctx.token) {
    throw new CliError('未登录：先运行 `ripple login`（或设置 RIPPLE_TOKEN）');
  }
}

/** 解析 --agent/--project 为 hub 安装目标；缺省用默认 Agent（全局） */
export function resolveTargets(
  ctx: CliContext,
  opts: { agent?: string; project?: string },
): InstallTarget[] {
  const agent = opts.agent ?? ctx.hub.state.default_agent;
  return [{ agent, ...(opts.project ? { projectDir: opts.project } : {}) }];
}

/** --to agent[:projectDir] 列表解析（sync 用） */
export function parseToTargets(specs: string[]): InstallTarget[] {
  return specs.map((spec) => {
    const idx = spec.indexOf(':');
    if (idx === -1) return { agent: spec };
    return { agent: spec.slice(0, idx), projectDir: spec.slice(idx + 1) };
  });
}
