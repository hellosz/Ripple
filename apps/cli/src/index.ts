import { Command } from 'commander';
import { RippleApiError } from '@ripple/api-client';
import { registerAuthCommands } from './commands/auth.js';
import { registerServiceCommands } from './commands/service.js';
import { registerLocalCommands } from './commands/local.js';
import { buildContext, type CliContext } from './context.js';
import { CliError, EXIT_FAILURE, EXIT_USAGE } from './output.js';
import { CLI_VERSION } from './version.js';
import type { GlobalFlags } from './config.js';

const program = new Command('ripple');

program
  .description('Ripple CLI — 发现、安装、同步与发布 AI Agent 技能')
  .version(CLI_VERSION, '-v, --version', '显示版本')
  .option('--server <url>', '服务地址（优先级高于 RIPPLE_SERVER 与 ~/.ripplerc）')
  .option('--token <token>', '访问 token（优先级高于 RIPPLE_TOKEN 与 ~/.ripplerc）')
  .option('--json', '输出机器可读 JSON（stdout 仅含数据）')
  .option('--yes', '跳过破坏性操作确认（非交互环境必需）')
  .showHelpAfterError('（用 --help 查看用法）')
  .exitOverride();

let ctx: CliContext | null = null;
const getCtx = (): CliContext => {
  if (!ctx) ctx = buildContext(program.opts<GlobalFlags>());
  return ctx;
};

registerAuthCommands(program, getCtx);
registerServiceCommands(program, getCtx);
registerLocalCommands(program, getCtx);

try {
  await program.parseAsync(process.argv);
  process.exit(0);
} catch (err) {
  // commander 的 help/version 正常退出
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code;
    if (code === 'commander.helpDisplayed' || code === 'commander.version' || code === 'commander.help') {
      process.exit(0);
    }
    if (code.startsWith('commander.')) {
      process.exit(EXIT_USAGE);
    }
  }
  if (err instanceof CliError) {
    process.stderr.write(`错误：${err.message}\n`);
    process.exit(err.exitCode);
  }
  if (err instanceof RippleApiError) {
    process.stderr.write(`错误 [${err.code}]：${err.message}\n`);
    process.exit(EXIT_FAILURE);
  }
  process.stderr.write(`错误：${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(EXIT_FAILURE);
}
