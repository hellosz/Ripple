import { spawn } from 'node:child_process';
import type { Command } from 'commander';
import { readRc, writeRc } from '../config.js';
import { CliError, emit, note, paint } from '../output.js';
import { buildContext, requireToken, type CliContext } from '../context.js';

function openBrowser(url: string): boolean {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    const child = spawn(command, [url], { detached: true, stdio: 'ignore', shell: process.platform === 'win32' });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function registerAuthCommands(program: Command, getCtx: () => CliContext): void {
  program
    .command('login')
    .description('设备码登录（--remote 打印验证链接与验证码，适合无浏览器环境）')
    .option('--remote', '不打开浏览器，仅打印验证信息')
    .action(async (opts: { remote?: boolean }) => {
      const ctx = getCtx();
      const init = await ctx.client.auth.deviceInit();
      if (opts.remote || !ctx.out.interactive) {
        note(ctx.out, `打开链接完成授权：${init.verification_url}`);
        note(ctx.out, `验证码：${paint(ctx.out, 'bold', init.user_code)}`);
      } else {
        note(ctx.out, `正在打开浏览器…（验证码 ${init.user_code}）`);
        if (!openBrowser(init.verification_url)) {
          note(ctx.out, `无法打开浏览器，请手动访问：${init.verification_url}`);
        }
      }
      const deadline = Date.now() + init.expires_in * 1000;
      for (;;) {
        if (Date.now() > deadline) throw new CliError('设备码已过期，请重新 login');
        await sleep(init.interval * 1000);
        const poll = await ctx.client.auth.devicePoll(init.device_code);
        if (poll.status === 'authorized' && poll.access_token) {
          const rc = readRc();
          writeRc({ ...rc, server: ctx.server, token: poll.access_token });
          emit(ctx.out, { logged_in: true, server: ctx.server }, () => {
            note(ctx.out, paint(ctx.out, 'green', `已登录 ${ctx.server}`));
          });
          return;
        }
        if (poll.status === 'expired') throw new CliError('设备码已过期，请重新 login');
      }
    });

  program
    .command('logout')
    .description('清除本地 token')
    .action(async () => {
      const ctx = getCtx();
      const rc = readRc();
      delete rc.token;
      writeRc(rc);
      emit(ctx.out, { logged_out: true }, () => note(ctx.out, '已退出登录'));
    });

  program
    .command('whoami')
    .description('显示当前登录身份')
    .action(async () => {
      const ctx = getCtx();
      requireToken(ctx);
      const me = await ctx.client.auth.me();
      emit(ctx.out, me, () => {
        process.stdout.write(`${me.nickname ?? me.email} <${me.email}> (${me.role})\n`);
      });
    });
}

export { buildContext };
