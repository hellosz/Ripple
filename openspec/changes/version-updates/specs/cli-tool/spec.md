# cli-tool（delta）

## ADDED Requirements

### Requirement: update 命令承载 CLI 自更新
`ripple update`（不带技能名与 `--all`）MUST 执行 CLI 自更新：检测到新版本时实际升级（`npm i -g <包>@latest`，继承终端输出）；执行前 MUST 确认（交互确认或 `--yes`），非交互且无 `--yes` 时回退为打印升级命令（退出码 0）；`--check` MUST 仅检查不执行；`ripple update <name>` 与 `ripple update --all` 语义不变（更新技能）。独立的 `self-update` 命令 MUST 移除（保留 `upgrade` 别名指向裸 update）。检查失败（离线/未发布）不报错，明示无法获取。

#### Scenario: 裸 update 自更新
- **WHEN** 执行 `ripple update` 且存在新版本，用户交互确认（或带 --yes）
- **THEN** 运行 npm 全局安装并回显结果；`ripple update <name>` 仍走技能更新

### Requirement: version 子命令
`ripple version` MUST 输出聚合版本视图：CLI 当前版本、Node 版本、配置的服务端及其版本（可达时）、npm registry 最新版（可达时）与是否有更新；支持 `--json`。

#### Scenario: 聚合版本视图
- **WHEN** 执行 `ripple version --json`
- **THEN** 输出含 current/node/server/latest/update_available 字段的 JSON
