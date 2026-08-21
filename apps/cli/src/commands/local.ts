import { readFileSync } from 'node:fs';
import type { Command } from 'commander';
import { payloadFromZip } from '@ripple/hub';
import { readRc, rcPath, writeRc, DEFAULT_SERVER } from '../config.js';
import { CliError, confirmDestructive, emit, note, paint } from '../output.js';
import { parseToTargets, requireToken, resolveTargets, type CliContext } from '../context.js';

async function payloadFromRegistry(ctx: CliContext, name: string) {
  const data = await ctx.client.skills.download(name);
  return payloadFromZip(new Uint8Array(data));
}

export function registerLocalCommands(program: Command, getCtx: () => CliContext): void {
  program
    .command('install <name>')
    .alias('i')
    .description('安装技能到本地（默认来源 Ripple 服务；--from 指定 GitHub 来源、--zip 离线导入）')
    .option('--agent <id>', '目标 Agent（缺省用默认 Agent）')
    .option('--project <dir>', '项目作用域（项目目录路径）')
    .option('--from <sourceId>', 'GitHub 来源 id（如 anthropics/skills，未登录可用）')
    .option('--zip <file>', '从本地 ZIP 安装（未登录可用）')
    .action(
      async (name: string, opts: { agent?: string; project?: string; from?: string; zip?: string }) => {
        const ctx = getCtx();
        const targets = resolveTargets(ctx, opts);
        let records;
        if (opts.zip) {
          records = ctx.hub.installFromZip(new Uint8Array(readFileSync(opts.zip)), targets);
        } else if (opts.from) {
          records = await ctx.hub.installFromRepo(opts.from, name, targets);
        } else {
          requireToken(ctx);
          const payload = await payloadFromRegistry(ctx, name);
          records = ctx.hub.install(payload, targets, { origin: 'registry' });
        }
        emit(ctx.out, records, () => {
          for (const r of records) {
            note(
              ctx.out,
              paint(ctx.out, 'green', `已安装 ${r.skill} v${r.version} → ${r.agent}${r.scope === 'global' ? '' : ` · ${r.scope}`} [${r.mode}]`),
            );
          }
        });
      },
    );

  program
    .command('update [name]')
    .alias('up')
    .description('更新技能（--all 更新全部落后安装，适合 CI）')
    .option('--all', '更新全部')
    .action(async (name: string | undefined, opts: { all?: boolean }) => {
      const ctx = getCtx();
      requireToken(ctx);
      const skillNames = opts.all
        ? [...new Set(ctx.hub.state.installs.map((i) => i.skill))]
        : name
          ? [name]
          : (() => {
              throw new CliError('指定技能名或使用 --all', 2);
            })();
      const results: Array<{ skill: string; from: string | null; to: string; updated: boolean }> = [];
      for (const skill of skillNames) {
        const current = ctx.hub.installedVersion(skill);
        let detail;
        try {
          detail = await ctx.client.skills.get(skill);
        } catch {
          note(ctx.out, `跳过 ${skill}（远端不存在）`);
          continue;
        }
        if (current === detail.version) {
          results.push({ skill, from: current, to: detail.version, updated: false });
          continue;
        }
        const payload = await payloadFromRegistry(ctx, skill);
        const targets = ctx.hub.state.installs
          .filter((i) => i.skill === skill)
          .map((i) => ({ agent: i.agent, ...(i.scope === 'global' ? {} : { projectDir: i.scope }) }));
        ctx.hub.install(payload, targets.length ? targets : [{ agent: ctx.hub.state.default_agent }], {
          origin: 'registry',
        });
        results.push({ skill, from: current, to: detail.version, updated: true });
      }
      emit(ctx.out, results, () => {
        for (const r of results) {
          process.stdout.write(
            r.updated ? `${r.skill}: ${r.from ?? '—'} → ${paint(ctx.out, 'green', r.to)}\n` : `${r.skill}: 已是最新 (${r.to})\n`,
          );
        }
        if (results.length === 0) note(ctx.out, '没有可更新的技能');
      });
    });

  program
    .command('uninstall <name>')
    .alias('rm')
    .alias('delete')
    .description('卸载技能（卸载前自动备份）')
    .option('--agent <id>', '仅卸载指定 Agent 的安装')
    .option('--project <dir>', '仅卸载指定项目作用域')
    .action(async (name: string, opts: { agent?: string; project?: string }) => {
      const ctx = getCtx();
      await confirmDestructive(ctx.out, `卸载 ${name}`);
      const target = opts.agent
        ? { agent: opts.agent, ...(opts.project ? { projectDir: opts.project } : {}) }
        : undefined;
      ctx.hub.uninstall(name, target);
      emit(ctx.out, { uninstalled: name }, () => note(ctx.out, `已卸载 ${name}（备份已保留）`));
    });

  program
    .command('sync <name>')
    .description('把技能同步收敛到指定目标集合（--to agent[:projectDir]，可多次）')
    .requiredOption('--to <target...>', '目标：agent 或 agent:projectDir')
    .action(async (name: string, opts: { to: string[] }) => {
      const ctx = getCtx();
      const records = ctx.hub.sync(name, parseToTargets(opts.to));
      emit(ctx.out, records, () =>
        note(ctx.out, paint(ctx.out, 'green', `已同步 ${name} 到 ${records.length} 个目标（已自动备份）`)),
      );
    });

  for (const [cmd, enabled] of [
    ['enable', true],
    ['disable', false],
  ] as const) {
    program
      .command(`${cmd} <name>`)
      .description(`${enabled ? '启用' : '禁用'}某处安装`)
      .requiredOption('--agent <id>', '目标 Agent')
      .option('--project <dir>', '项目作用域')
      .action(async (name: string, opts: { agent: string; project?: string }) => {
        const ctx = getCtx();
        const record = ctx.hub.setEnabled(
          name,
          { agent: opts.agent, ...(opts.project ? { projectDir: opts.project } : {}) },
          enabled,
        );
        emit(ctx.out, record, () =>
          note(ctx.out, `${enabled ? '已启用' : '已禁用'}：${name} @ ${opts.agent}`),
        );
      });
  }

  // ---- agent ----
  const agent = program.command('agent').description('Agent 检测与扫描');
  agent
    .command('list')
    .description('列出 Agent 检测状态与安装数')
    .action(async () => {
      const ctx = getCtx();
      const agents = ctx.hub.detectAgents().map((a) => ({
        id: a.id,
        name: a.name,
        detected: a.detected,
        global_path: a.globalPath,
        installs: ctx.hub.state.installs.filter((i) => i.agent === a.id).length,
      }));
      emit(ctx.out, agents, () => {
        for (const a of agents) {
          const dot = a.detected ? paint(ctx.out, 'green', '●') : paint(ctx.out, 'dim', '○');
          process.stdout.write(`${dot} ${a.name.padEnd(18)} ${a.global_path}  (${a.installs})\n`);
        }
      });
    });
  agent
    .command('scan')
    .description('重新扫描本地目录（unmanaged / 版本冲突 / 分发丢失）；--adopt 接管既有技能')
    .option('--adopt', '把未纳管的既有技能接管进中心存储与安装记录')
    .action(async (opts: { adopt?: boolean }) => {
      const ctx = getCtx();
      if (opts.adopt) {
        const { adopted, skipped } = ctx.hub.adoptAll();
        emit(ctx.out, { adopted, skipped }, () => {
          note(ctx.out, `已接管 ${adopted.length} 个既有技能，跳过 ${skipped.length} 个（无 SKILL.md）`);
          for (const r of adopted) process.stdout.write(`+ ${r.skill} v${r.version} @ ${r.agent}\n`);
        });
        return;
      }
      const issues = ctx.hub.scan();
      emit(ctx.out, issues, () => {
        if (issues.length === 0) {
          note(ctx.out, '扫描完成：没有发现问题');
          return;
        }
        for (const issue of issues) {
          process.stdout.write(`[${issue.kind}] ${issue.skill}: ${issue.detail}\n`);
        }
        if (issues.some((i) => i.kind === 'unmanaged')) {
          note(ctx.out, '提示：`ripple agent scan --adopt` 可接管以上既有技能');
        }
      });
    });

  // ---- source ----
  const source = program.command('source').description('GitHub 技能来源管理（未登录可用）');
  source
    .command('list')
    .description('列出来源仓库')
    .action(async () => {
      const ctx = getCtx();
      const sources = ctx.hub.listSources();
      emit(ctx.out, sources, () => {
        for (const s of sources) {
          process.stdout.write(
            `${s.id}#${s.branch}${s.subdir ? `:${s.subdir}` : ''}  ${s.note}${s.builtin ? '（内置）' : ''}\n`,
          );
        }
      });
    });
  source
    .command('add <spec>')
    .description('添加来源：owner/repo[#branch][:subdir]')
    .action(async (spec: string) => {
      const ctx = getCtx();
      const added = ctx.hub.addSource(spec);
      emit(ctx.out, added, () => note(ctx.out, `已添加来源 ${added.id}`));
    });
  source
    .command('remove <id>')
    .description('移除来源（已装技能保留，不再更新）')
    .action(async (id: string) => {
      const ctx = getCtx();
      await confirmDestructive(ctx.out, `移除来源 ${id}`);
      ctx.hub.removeSource(id);
      emit(ctx.out, { removed: id }, () => note(ctx.out, `已移除来源 ${id}（已装技能保留）`));
    });
  source
    .command('skills <id>')
    .description('列出来源仓库内可安装的技能')
    .action(async (id: string) => {
      const ctx = getCtx();
      const skills = await ctx.hub.listRepoSkills(id);
      emit(ctx.out, skills, () => {
        for (const s of skills) process.stdout.write(`${s.name} v${s.version}  ${s.description.slice(0, 60)}\n`);
      });
    });

  // ---- backup ----
  const backup = program.command('backup').description('备份管理（自动保留最近 20 份）');
  backup
    .command('list')
    .description('列出备份')
    .action(async () => {
      const ctx = getCtx();
      const backups = ctx.hub.listBackups();
      emit(ctx.out, backups, () => {
        if (backups.length === 0) {
          note(ctx.out, '暂无备份');
          return;
        }
        for (const b of backups) {
          process.stdout.write(`${b.id}  ${b.skill} ${b.version}  ${b.reason}  ${(b.size / 1024).toFixed(1)}KB  ${b.created_at}\n`);
        }
      });
    });
  backup
    .command('restore <id>')
    .description('从备份恢复（重建全部分发）')
    .action(async (id: string) => {
      const ctx = getCtx();
      const record = ctx.hub.restoreBackup(id);
      emit(ctx.out, record, () =>
        note(ctx.out, paint(ctx.out, 'green', `已恢复 ${record.skill} ${record.version}`)),
      );
    });
  backup
    .command('prune')
    .description('清空全部备份（不可恢复）')
    .action(async () => {
      const ctx = getCtx();
      await confirmDestructive(ctx.out, '删除全部备份');
      const count = ctx.hub.listBackups().length;
      for (const b of ctx.hub.listBackups()) ctx.hub.deleteBackup(b.id);
      emit(ctx.out, { pruned: count }, () => note(ctx.out, `已删除 ${count} 份备份`));
    });

  // ---- log ----
  program
    .command('log')
    .description('本地操作记录（安装/同步/启停/卸载/回退/来源与设置变更）')
    .option('--limit <n>', '显示条数', '30')
    .action(async (opts: { limit: string }) => {
      const ctx = getCtx();
      const entries = ctx.hub.state.oplog.slice(0, Math.max(1, Number(opts.limit) || 30));
      emit(ctx.out, entries, () => {
        if (entries.length === 0) {
          note(ctx.out, '暂无操作记录');
          return;
        }
        for (const e of entries) {
          process.stdout.write(`${e.at}  [${e.action}] ${e.target}  ${e.detail}\n`);
        }
      });
    });

  // ---- config ----
  const config = program.command('config').description('CLI 配置（分层：flag > env > ~/.ripplerc > 默认）');
  config
    .command('get [key]')
    .description('查看生效配置及来源')
    .action(async (key: string | undefined) => {
      const ctx = getCtx();
      const entries = {
        server: { value: ctx.server, source: resolveSource(ctx, 'server') },
        token: {
          value: ctx.token ? `${ctx.token.slice(0, 12)}…` : '',
          source: ctx.tokenSource,
        },
        default_agent: { value: ctx.hub.state.default_agent, source: 'file' },
        config_file: { value: rcPath(), source: 'default' },
      } as const;
      const data = key ? { [key]: entries[key as keyof typeof entries] } : entries;
      emit(ctx.out, data, () => {
        for (const [k, v] of Object.entries(data)) {
          if (!v) continue;
          process.stdout.write(`${k} = ${v.value || '(未设置)'}  (${v.source})\n`);
        }
      });
    });
  config
    .command('set <key> <value>')
    .description('写入 ~/.ripplerc（支持 server / default_agent）')
    .action(async (key: string, value: string) => {
      const ctx = getCtx();
      if (key === 'server') {
        writeRc({ ...readRc(), server: value });
      } else if (key === 'default_agent') {
        ctx.hub.state.default_agent = value;
        ctx.hub.save();
      } else {
        throw new CliError(`不支持的配置项：${key}（支持 server / default_agent）`, 2);
      }
      emit(ctx.out, { [key]: value }, () => note(ctx.out, `已设置 ${key} = ${value}`));
    });

  function resolveSource(ctx: CliContext, key: 'server'): string {
    if (ctx.flags.server) return 'flag';
    if (process.env.RIPPLE_SERVER) return 'env';
    if (readRc().server) return 'file';
    void key;
    return `default (${DEFAULT_SERVER})`;
  }
}
