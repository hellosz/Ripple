# Proposal: version-updates

## Why
CLI 的 self-update 只打印升级提示、不执行；桌面端自动更新仅有后台行为，没有查看当前版本与手动检查更新的入口。

## What Changes
- **桌面**：设置新增「关于与更新」tab——当前版本、更新通道（GitHub Release）说明、「检查更新」按钮与全状态流（检查中/已是最新/发现新版/下载进度/已就绪→重启安装/失败原因）；主进程暴露手动检查 IPC 并转发下载进度事件。
- **CLI**：移除 `self-update`，由 **`ripple update`（无参数）** 承载 CLI 自更新并**实际执行**（确认后运行 `npm i -g @hellosz/ripple@latest`，`--check` 仅检查、`--yes` 免确认，非交互无 `--yes` 回退为提示）；`ripple update <name>`/`--all` 技能更新语义不变；新增 `ripple version` 子命令（本体 + 服务端 + npm 最新版聚合视图）。

## Capabilities
### Modified Capabilities
- `desktop-client`: 关于与更新入口。
- `cli-tool`: self-update 执行化与 version 子命令。

## Impact
apps/desktop（main/shared/renderer）、apps/cli。
