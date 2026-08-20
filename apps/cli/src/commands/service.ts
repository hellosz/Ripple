import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import type { Command } from 'commander';
import { buildZip } from '@ripple/skill-core';
import { readDirFiles } from '@ripple/hub';
import { CliError, emit, note, paint } from '../output.js';
import { requireToken, type CliContext } from '../context.js';
import { CLI_VERSION } from '../version.js';

export function registerServiceCommands(program: Command, getCtx: () => CliContext): void {
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

  program
    .command('self-update')
    .alias('upgrade')
    .description('检查 CLI 新版本')
    .action(async () => {
      const ctx = getCtx();
      let latest = '';
      let hint = 'npm i -g ripple@latest';
      try {
        const info = await ctx.client.meta.cliVersion();
        latest = info.latest;
        hint = info.install_hint;
      } catch {
        // 服务不可达时直接查 npm registry
        try {
          const res = await fetch('https://registry.npmjs.org/ripple/latest');
          if (res.ok) latest = ((await res.json()) as { version?: string }).version ?? '';
        } catch {
          /* 离线 */
        }
      }
      const payload = { current: CLI_VERSION, latest, update_available: Boolean(latest && latest !== CLI_VERSION) };
      emit(ctx.out, payload, () => {
        if (!latest) {
          note(ctx.out, `当前版本 ${CLI_VERSION}（无法获取最新版本信息）`);
        } else if (payload.update_available) {
          process.stdout.write(`有新版本 ${latest}（当前 ${CLI_VERSION}）：${hint}\n`);
        } else {
          process.stdout.write(`已是最新版本 ${CLI_VERSION}\n`);
        }
      });
    });
}
