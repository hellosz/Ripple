# Ripple CLI

管理 AI skill 的命令行工具——登录、搜索、查看、安装、更新、卸载、打包发布，支持装到 Claude Code、Codex、Cursor 等不同 agent 的 skills 目录。

## 一键安装

```bash
# 本地一键安装（链接到全局 bin）
bash cli/install.sh

# 或发布后
npm install -g @ripple/cli
```

安装后 `ripple` 命令全局可用。

## 登录（浏览器授权）

```bash
ripple login            # 本机模式：自动打开浏览器，实时回传
ripple login --remote   # 远程模式：打印链接 + 验证码，循环探测
```

登录后 token 保存在 `~/.ripplerc`（权限 600）。

## 命令

| 命令 | 说明 |
|---|---|
| `ripple login [--remote]` | 登录（浏览器授权） |
| `ripple logout` | 登出 |
| `ripple whoami` | 当前登录用户 |
| `ripple version` | 显示 CLI 版本 |
| `ripple update` | 自更新 CLI（无参数时） |
| `ripple list` | 列出所有 skill |
| `ripple search <query>` | 搜索 skill |
| `ripple info <name>` | 查看 skill 详情 |
| `ripple install <name> [--target t]` | 安装到指定 agent 目录 |
| `ripple update <name> [--target t]` | 更新已安装的 skill |
| `ripple uninstall <name> [--target t]` | 卸载本地 skill |
| `ripple publish <path> --recommendation "..." [--channel c]` | 打包发布（仅管理员） |
| `ripple config` | 查看配置 |

## 发布（publish，仅管理员）

```bash
# 正式发布（默认）
ripple publish ./my-skill --recommendation "推荐语" --category tools

# 灰度发布（仅管理员可见）
ripple publish ./my-skill --recommendation "推荐语" --channel gray
```

- `--channel production|gray`：正式（所有人可见）或灰度（仅管理员可见）
- 只有管理员有权限 publish（普通用户会收到 `Admin access required`）
- 目录自动打包成 ZIP，也可直接传 ZIP

## 安装目标（--target）

| target | 目录 | 对应 agent |
|---|---|---|
| `skills`（默认） | `.skills/` | 通用 |
| `claude` | `.claude/skills/` | Claude Code |
| `codex` | `.codex/skills/` | OpenAI Codex |
| `cursor` | `.cursor/skills/` | Cursor |

也可用 `--dir <path>` 指定任意目录。

## 配置

优先级（从高到低）：CLI 参数 > 环境变量 > `~/.ripplerc` > 默认值。

| 项 | 环境变量 | 默认 |
|---|---|---|
| server | `RIPPLE_SERVER` | `http://localhost:8000` |
| token | `RIPPLE_TOKEN` | — |
