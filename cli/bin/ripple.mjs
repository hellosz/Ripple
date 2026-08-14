#!/usr/bin/env node

import { parseArgs } from "node:util";
import {
  loadConfig,
  saveConfig,
  resolveServer,
  resolveToken,
  CONFIG_PATH,
} from "../lib/config.mjs";
import { deviceLogin, whoami } from "../lib/auth.mjs";
import { list, info } from "../lib/skills.mjs";
import { apiJson } from "../lib/api.mjs";
import { install, update, remove } from "../lib/install.mjs";
import { publish } from "../lib/publish.mjs";
import { listAgents } from "../lib/agents.mjs";
import { readFileSync } from "node:fs";

const VERSION = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8")
).version;

const HELP = `
  ripple — Ripple AI Skill 管理工具

  用法:
    ripple login [--remote]                登录（打开浏览器授权）
    ripple logout                          登出
    ripple whoami                          查看当前登录用户
    ripple list                            列出所有 skill
    ripple search <query>                  搜索 skill
    ripple info <name>                     查看 skill 详情
    ripple install <name> [--target t]     安装 skill 到指定 agent 目录
    ripple version                         显示 CLI 版本
    ripple update                          自更新 CLI（无参数）
    ripple update  <name> [--target t]     更新已安装的 skill
    ripple uninstall <name> [--target t]   卸载本地 skill
    ripple publish <path> --recommendation "推荐语" [--channel c]  打包发布（管理员）
    ripple config                          查看配置

  选项:
    --server <url>       服务地址 (默认 http://localhost:8000)
    --target <t>         安装目标: skills|claude|codex|cursor (默认 skills)
    --dir <path>         自定义安装目录（优先于 --target）
    --remote             登录用远程模式（打印链接，不自动开浏览器）
    --recommendation <s> 发布时的推荐语（必填）
    --category <c>       发布时的分类（留空则从 SKILL.md 读）
    --origin <o>         发布来源: original|derivative|repost (默认 original)
    --tags <a,b>         发布标签（逗号分隔）
    --channel <c>        发布渠道: production|gray (默认 production，仅管理员)
    -h, --help           帮助
    -v, --version        版本

  示例:
    ripple login
    ripple login --remote
    ripple search github
    ripple install skill-porting-engineer --target claude
    ripple publish ./my-skill --recommendation "好用的技能" --category tools
`;

async function selfUpdate(server) {
  console.log(`当前版本: ripple-cli ${VERSION}`);
  try {
    const latest = await apiJson("/cli/version", { server, token: "" });
    console.log(`最新版本: ${latest.version}`);
    if (latest.version !== VERSION) {
      console.log("\n发现新版本，请升级:");
      console.log("  npm install -g @ripple/cli@latest");
      console.log("  或重新运行: bash cli/install.sh");
    } else {
      console.log("✓ 已是最新版本");
    }
  } catch {
    console.log("无法获取最新版本信息（服务未响应）");
    console.log("更新方式: npm install -g @ripple/cli@latest");
  }
}

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      server: { type: "string", default: "" },
      target: { type: "string", default: "" },
      dir: { type: "string", default: "" },
      token: { type: "string", default: "" },
      remote: { type: "boolean", default: false },
      recommendation: { type: "string", default: "" },
      category: { type: "string", default: "" },
      origin: { type: "string", default: "" },
      tags: { type: "string", default: "" },
      channel: { type: "string", default: "" },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });

  if (values.version) {
    console.log("ripple-cli 0.3.0");
    process.exit(0);
  }

  const command = positionals[0];
  const args = positionals.slice(1);
  const saved = loadConfig();
  const config = {
    server: resolveServer(values, saved),
    token: resolveToken(values, saved),
  };

  if (values.help || !command) {
    console.log(HELP);
    process.exit(0);
  }

  switch (command) {
    case "login": {
      const token = await deviceLogin(config.server, { remote: values.remote });
      const me = await whoami({ server: config.server, token });
      saveConfig({ ...saved, server: config.server, token, email: me.email });
      console.log(`✓ 已登录 ${me.email} (${me.nickname || ""})`);
      break;
    }

    case "logout": {
      saveConfig({ ...saved, token: "", email: "" });
      console.log("✓ 已登出");
      break;
    }

    case "version":
    case "-v": {
      console.log(`ripple-cli ${VERSION}`);
      break;
    }

    case "whoami": {
      const me = await whoami(config);
      console.log(`当前用户: ${me.email}  昵称: ${me.nickname || "-"}  角色: ${me.role}`);
      break;
    }

    case "list":
    case "ls": {
      const data = await list(config);
      console.log(`\n共 ${data.total} 个 skill\n`);
      for (const s of data.items) {
        console.log(`  [${s.rating}] ${s.name}  —  ${s.display_name}  v${s.version}`);
      }
      console.log("");
      break;
    }

    case "search":
    case "s": {
      const q = args.join(" ");
      if (!q) {
        console.error("用法: ripple search <query>");
        process.exit(1);
      }
      const data = await list(config, q);
      console.log(`\n搜索 "${q}"：${data.total} 个结果\n`);
      for (const s of data.items) {
        console.log(`  [${s.rating}] ${s.name}  —  ${s.display_name}  v${s.version}`);
      }
      console.log("");
      break;
    }

    case "info":
    case "show": {
      if (!args[0]) {
        console.error("用法: ripple info <name>");
        process.exit(1);
      }
      const s = await info(args[0], config);
      console.log(`\n${s.display_name}  v${s.version}  [${s.rating}]`);
      console.log(`分类: ${s.category || "-"}   来源: ${s.origin_type}`);
      console.log(`描述: ${s.description}`);
      console.log(`作者: ${s.author?.nickname || s.author?.email || "-"}`);
      console.log(`安装命令: ${s.install_command}`);
      console.log(`统计: 下载 ${s.stats.download_count} · 点赞 ${s.stats.like_count} · 涟漪 ${s.stats.ripple_count}\n`);
      break;
    }

    case "install":
    case "i": {
      if (!args[0]) {
        console.error("用法: ripple install <name> [--target claude|codex|skills]");
        process.exit(1);
      }
      await install(args[0], config, { target: values.target, dir: values.dir });
      break;
    }

    case "update":
    case "up": {
      if (!args[0]) {
        await selfUpdate(config.server);
        break;
      }
      await update(args[0], config, { target: values.target, dir: values.dir });
      break;
    }

    case "upgrade":
    case "self-update": {
      await selfUpdate(config.server);
      break;
    }

    case "delete":
    case "uninstall":
    case "rm": {
      if (!args[0]) {
        console.error("用法: ripple delete <name> [--target ...]");
        process.exit(1);
      }
      await remove(args[0], { target: values.target, dir: values.dir });
      break;
    }

    case "publish":
    case "pub": {
      if (!args[0]) {
        console.error(
          "用法: ripple publish <skill.zip|目录> --recommendation \"推荐语\" [--category x] [--origin original] [--tags a,b]"
        );
        process.exit(1);
      }
      if (!values.recommendation) {
        console.error("发布需要 --recommendation \"推荐语\"");
        process.exit(1);
      }
      if (!config.token) {
        console.error("请先登录: ripple login");
        process.exit(1);
      }
      await publish(args[0], config, {
        recommendation: values.recommendation,
        category: values.category,
        origin: values.origin,
        tags: values.tags,
        channel: values.channel,
      });
      break;
    }

    case "config": {
      console.log(`配置文件: ${CONFIG_PATH}`);
      console.log(`Server : ${config.server}`);
      console.log(`Email  : ${saved.email || "(未登录)"}`);
      console.log(`Token  : ${config.token ? "****" : "(未登录)"}`);
      console.log(`可用 target:`);
      for (const [key, dir, label] of listAgents()) {
        console.log(`  ${key.padEnd(8)} ${dir}  (${label})`);
      }
      break;
    }

    default:
      console.error(`未知命令: ${command}\n`);
      console.log(HELP);
      process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
