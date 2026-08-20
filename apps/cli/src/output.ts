import { createInterface } from 'node:readline/promises';

export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;

export interface OutputContext {
  json: boolean;
  yes: boolean;
  interactive: boolean;
  color: boolean;
}

export function makeOutput(flags: { json?: boolean; yes?: boolean }): OutputContext {
  const interactive = Boolean(process.stdout.isTTY && process.stdin.isTTY);
  return {
    json: Boolean(flags.json),
    yes: Boolean(flags.yes),
    interactive,
    // 非 TTY 自动禁用彩色
    color: Boolean(process.stdout.isTTY) && !process.env.NO_COLOR,
  };
}

export class CliError extends Error {
  readonly exitCode: number;
  constructor(message: string, exitCode = EXIT_FAILURE) {
    super(message);
    this.exitCode = exitCode;
  }
}

const codes = { green: 32, yellow: 33, red: 31, cyan: 36, dim: 2, bold: 1 } as const;

export function paint(ctx: OutputContext, color: keyof typeof codes, text: string): string {
  return ctx.color ? `[${codes[color]}m${text}[0m` : text;
}

/** JSON 模式：稳定结构走 stdout；人类可读文本只在非 JSON 模式输出 */
export function emit(ctx: OutputContext, data: unknown, human: () => void): void {
  if (ctx.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  } else {
    human();
  }
}

/** 进度/提示信息走 stderr，不污染 stdout 数据流 */
export function note(ctx: OutputContext, message: string): void {
  if (!ctx.json) process.stderr.write(message + '\n');
}

/** 破坏性操作确认：--yes 直接放行；非交互无 --yes 拒绝（退出码 1） */
export async function confirmDestructive(ctx: OutputContext, action: string): Promise<void> {
  if (ctx.yes) return;
  if (!ctx.interactive) {
    throw new CliError(`拒绝执行「${action}」：非交互模式下破坏性操作需要 --yes`, EXIT_FAILURE);
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question(`确认${action}？[y/N] `);
    if (!/^y(es)?$/i.test(answer.trim())) {
      throw new CliError('已取消', EXIT_FAILURE);
    }
  } finally {
    rl.close();
  }
}
