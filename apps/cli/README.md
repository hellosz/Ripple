# ripple

Ripple CLI — 发现、安装、同步与发布 AI Agent 技能。

```bash
npm i -g ripple
ripple login
ripple search git
ripple install git-archaeologist --agent claude-code
ripple update --all          # CI 里保持团队技能一致
ripple publish ./my-skill --recommendation "..." --category 工具链
```

## 命令总览

| 分组 | 命令 |
|---|---|
| 认证 | `login [--remote]` · `logout` · `whoami` |
| 发现 | `search <q>` · `info <name>` · `list [--installed]` |
| 本地 | `install <name> [--agent] [--project] [--from <repo>] [--zip <file>]` · `update [name] [--all]` · `uninstall <name>` · `sync <name> --to <agent[:dir]>...` · `enable/disable <name> --agent <id>` |
| Agent | `agent list` · `agent scan` |
| 来源 | `source list/add/remove/skills`（GitHub 仓库源，未登录可用） |
| 备份 | `backup list/restore <id>/prune` |
| 配置 | `config get [key]` · `config set <key> <value>` |
| 其他 | `publish <path>` · `self-update` |

## 脚本化约定

- 全局 `--json`：stdout 输出稳定 JSON；提示与进度只走 stderr。
- 退出码：`0` 成功 · `1` 业务失败 · `2` 参数错误。
- 非 TTY 自动禁用彩色与交互；破坏性操作需 `--yes`。
- 配置分层：命令行参数 > `RIPPLE_SERVER`/`RIPPLE_TOKEN` 环境变量 > `~/.ripplerc` > 默认值。

## 旧版（v0.x @ripple/cli）迁移对照

| 旧命令 | 新命令 |
|---|---|
| `ripple install <name> --target claude` | `ripple install <name> --agent claude-code` |
| `ripple install <name> --dir <path>` | `ripple install <name> --project <path>` |
| `ripple update`（自更新） | `ripple self-update` |
| `ripple update <name>` | `ripple update <name>`（不变；新增 `--all`） |
| `ripple uninstall / delete / rm` | 不变（新增卸载前自动备份） |
| `ripple publish <path> --recommendation ...` | 不变（打包改为纯 Node，无需系统 zip） |
| `ripple config` | `ripple config get` |
| `ripple version` / `-v` | `ripple --version`（版本与 npm 包一致） |
| `~/.ripplerc`（KEY=VALUE） | 自动兼容读取，写入转 JSON 格式 |

高频别名保留：`i`=install、`s`=search、`ls`=list、`up`=update、`rm`/`delete`=uninstall、`pub`=publish、`show`=info、`upgrade`=self-update。

行为变化（BREAKING）：
- 安装不再解压到当前目录的 `.skills/`，而是进入中心存储（`~/.ripple/skills`）并按 Agent 分发（默认 symlink）。
- 需要 Node ≥ 20；不再依赖系统 `zip`/`unzip`。
