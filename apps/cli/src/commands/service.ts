import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline/promises';
import type { Command } from 'commander';
import { buildZip } from '@ripple/skill-core';
import { readDirFiles } from '@ripple/hub';
import { CliError, emit, note, paint } from '../output.js';
import { requireToken, type CliContext } from '../context.js';
import { CLI_PACKAGE_NAME, CLI_VERSION } from '../version.js';

async function fetchWithTimeout(url: string, ms = 5000): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 最新版查询：优先服务端 /api/cli/version，回退 npm registry；均不可达返回 null */
export async function fetchLatestCliVersion(
  ctx: CliContext,
): Promise<{ latest: string | null; hint: string }> {
  try {
    const info = await ctx.client.meta.cliVersion();
    if (info.latest) return { latest: info.latest, hint: info.install_hint };
  } catch {
    /* 服务不可达 → npm */
  }
  const res = await fetchWithTimeout(
    `https://registry.npmjs.org/${encodeURIComponent(CLI_PACKAGE_NAME)}/latest`,
  );
  if (res?.ok) {
    const data = (await res.json()) as { version?: string };
    if (data.version) return { latest: data.version, hint: `npm i -g ${CLI_PACKAGE_NAME}@latest` };
  }
  return { latest: null, hint: `npm i -g ${CLI_PACKAGE_NAME}@latest` };
}

/** CLI 自更新（由裸 `ripple update` 调用）：--check 仅检查；确认后实际执行 npm 全局安装 */
export async function runSelfUpdate(
  ctx: CliContext,
  opts: { check?: boolean },
): Promise<void> {
  const { latest, hint } = await fetchLatestCliVersion(ctx);
  const updateAvailable = Boolean(latest && latest !== CLI_VERSION);
  const payload = { current: CLI_VERSION, latest, update_available: updateAvailable };
  if (!latest) {
    emit(ctx.out, payload, () =>
      note(ctx.out, `当前版本 ${CLI_VERSION}（无法获取最新版本：离线或包尚未发布）`),
    );
    return;
  }
  if (!updateAvailable) {
    emit(ctx.out, payload, () => process.stdout.write(`已是最新版本 ${CLI_VERSION}
`));
    return;
  }
  if (opts.check) {
    emit(ctx.out, payload, () =>
      process.stdout.write(`有新版本 ${latest}（当前 ${CLI_VERSION}）：${hint}
`),
    );
    return;
  }
  // 执行升级：交互确认或 --yes；非交互无 --yes 回退为提示（退出码 0）
  if (!ctx.out.yes) {
    if (!ctx.out.interactive) {
      emit(ctx.out, payload, () =>
        process.stdout.write(`有新版本 ${latest}（当前 ${CLI_VERSION}）。非交互模式请执行：${hint}
`),
      );
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    try {
      const answer = await rl.question(`升级 ${CLI_VERSION} → ${latest}？[Y/n] `);
      if (/^n(o)?$/i.test(answer.trim())) {
        note(ctx.out, '已取消');
        return;
      }
    } finally {
      rl.close();
    }
  }
  note(ctx.out, `正在升级：npm i -g ${CLI_PACKAGE_NAME}@latest`);
  const result = spawnSync('npm', ['i', '-g', `${CLI_PACKAGE_NAME}@latest`], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status === 0) {
    emit(ctx.out, { ...payload, upgraded: true }, () =>
      note(ctx.out, paint(ctx.out, 'green', `升级完成：${CLI_VERSION} → ${latest}`)),
    );
  } else {
    throw new CliError(`npm 安装失败（退出码 ${result.status ?? '未知'}），可手动执行：${hint}`);
  }
}

export function registerServiceCommands(program: Command, getCtx: () => CliContext): void {
  program
    .command('version')
    .description('聚合版本视图：CLI / Node / 服务端 / npm 最新版')
    .action(async () => {
      const ctx = getCtx();
      let serverVersion: string | null = null;
      try {
        serverVersion = (await ctx.client.meta.health()).version;
      } catch {
        /* 服务不可达 */
      }
      const { latest } = await fetchLatestCliVersion(ctx);
      const payload = {
        current: CLI_VERSION,
        node: process.version,
        server: ctx.server,
        server_version: serverVersion,
        latest,
        update_available: Boolean(latest && latest !== CLI_VERSION),
      };
      emit(ctx.out, payload, () => {
        process.stdout.write(`ripple CLI  ${CLI_VERSION}${payload.update_available ? paint(ctx.out, 'yellow', `（可升级 → ${latest}，运行 ripple update）`) : ''}
`);
        process.stdout.write(`Node        ${process.version}
`);
        process.stdout.write(`服务端      ${ctx.server}${serverVersion ? `（v${serverVersion}）` : '（不可达）'}
`);
        process.stdout.write(`npm 最新    ${latest ?? '无法获取'}
`);
      });
    });

  program
    .command('search <query>')
    .alias('s')
    .description('搜索远端技能')
    .action(async (query: string) => {
      const ctx = getCtx();
      const result = await ctx.client.skills.list({ search: query, page_size: 20 });
      emit(ctx.out, result.items, () => {
        if (result.items.length === 0) {
          note(ctx.out, '没有匹配的技能');
          return;
        }
        for (const item of result.items) {
          process.stdout.write(
            `${paint(ctx.out, 'bold', item.name)}  [${item.rating}] ♨${item.stats.heat}  ${item.description.slice(0, 60)}\n`,
          );
        }
      });
    });

  program
    .command('info <name>')
    .alias('show')
    .description('查看技能详情')
    .action(async (name: string) => {
      const ctx = getCtx();
      const detail = await ctx.client.skills.get(name);
      emit(ctx.out, detail, () => {
        process.stdout.write(`${paint(ctx.out, 'bold', detail.display_name)} (${detail.name}) v${detail.version}\n`);
        process.stdout.write(`评级 ${detail.rating} · 热度 ${detail.stats.heat} · 分类 ${detail.category ?? '-'}\n`);
        process.stdout.write(`${detail.description}\n`);
        process.stdout.write(`安装：${detail.install_command}\n`);
      });
    });

  program
    .command('list')
    .alias('ls')
    .description('列出远端技能（--installed 列本地安装矩阵）')
    .option('--installed', '列出本地安装')
    .action(async (opts: { installed?: boolean }) => {
      const ctx = getCtx();
      if (opts.installed) {
        const installs = ctx.hub.state.installs;
        emit(ctx.out, installs, () => {
          if (installs.length === 0) {
            note(ctx.out, '本地暂无安装');
            return;
          }
          for (const i of installs) {
            const scope = i.scope === 'global' ? '全局' : i.scope;
            process.stdout.write(
              `${paint(ctx.out, 'bold', i.skill)} v${i.version}  ${i.agent} · ${scope}  ${i.enabled ? '' : '(已禁用)'} [${i.mode}]\n`,
            );
          }
        });
        return;
      }
      const result = await ctx.client.skills.list({ page_size: 50 });
      emit(ctx.out, result.items, () => {
        for (const item of result.items) {
          process.stdout.write(`${item.name}  v${item.version}  [${item.rating}] ♨${item.stats.heat}\n`);
        }
      });
    });

  program
    .command('publish <path>')
    .alias('pub')
    .description('发布技能（目录自动打包，或直接指定 zip）')
    .requiredOption('--recommendation <text>', '推荐语（必填）')
    .option('--category <category>', '分类')
    .option('--origin <origin>', '来源：original/derivative/repost', 'original')
    .option('--tags <tags>', '逗号分隔标签')
    .option('--channel <channel>', '发布渠道：production/gray', 'production')
    .action(
      async (
        path: string,
        opts: {
          recommendation: string;
          category?: string;
          origin: string;
          tags?: string;
          channel: string;
        },
      ) => {
        const ctx = getCtx();
        requireToken(ctx);
        let data: Uint8Array;
        let fileName: string;
        const stats = statSync(path);
        if (stats.isDirectory()) {
          const files = readDirFiles(path);
          if (!files['SKILL.md']) throw new CliError(`目录缺少 SKILL.md：${path}`);
          data = buildZip(files);
          fileName = `${basename(path)}.zip`;
        } else {
          data = new Uint8Array(readFileSync(path));
          fileName = basename(path);
        }
        const formData = new FormData();
        formData.set('file', new Blob([Buffer.from(data)], { type: 'application/zip' }), fileName);
        formData.set('recommendation', opts.recommendation);
        if (opts.category) formData.set('category', opts.category);
        formData.set('origin_type', opts.origin);
        if (opts.tags) formData.set('tags', opts.tags);
        formData.set('publish_channel', opts.channel);
        const result = await ctx.client.skills.upload(formData);
        emit(ctx.out, result, () => {
          note(ctx.out, paint(ctx.out, 'green', `发布成功：${result.skill.name} v${result.skill.version}`));
          process.stdout.write(`评级：${result.rating}\n`);
          if (result.suggestions.length > 0) {
            process.stdout.write('改进建议：\n');
            for (const s of result.suggestions) process.stdout.write(`  - ${s}\n`);
          }
          process.stdout.write(`安装命令：${result.install_command}\n`);
        });
      },
    );

}
