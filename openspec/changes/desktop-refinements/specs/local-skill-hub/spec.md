# local-skill-hub（delta）

## ADDED Requirements

### Requirement: 共享目录 placement 语义
适配器 SHALL 标注是否原生支持 agentskills.io 共享目录 `~/.agents/skills`（Codex、OpenCode 为 true）。默认存储位置 SHALL 为共享目录。当存储位于共享目录且目标 Agent 支持共享标准时，安装 MUST 记录为 `mode=shared` 且不产生重复分发；不支持共享的 Agent 仍以 symlink/copy 分发（专属）。安装目标可显式要求 `dedicated`（Agent 粒度个性化），此时 MUST 强制分发进该 Agent 私有目录。

#### Scenario: 共享标准 Agent 不重复分发
- **WHEN** 存储为共享目录且把技能安装到 Codex
- **THEN** 安装记录 mode=shared，`~/.codex/skills/` 下不产生该技能的链接或副本

#### Scenario: 专属个性化覆盖
- **WHEN** 以 dedicated 方式把技能安装到 Codex
- **THEN** `~/.codex/skills/<name>` 产生独立分发，记录 mode 为 symlink/junction/copy

### Requirement: SSOT 所有权跟踪
hub MUST 跟踪自己写入 SSOT 的技能目录（owned）。卸载最后一处安装时，仅当该目录为 owned 才删除 SSOT 内容；非 owned（如共享目录中其他工具放置、adopt 引用的目录）MUST 保留。

#### Scenario: 卸载不删他人内容
- **WHEN** 共享目录中存在 lark-cli 放置的技能且用户经 adopt 纳管后又卸载
- **THEN** 安装记录移除，但 `~/.agents/skills/<name>` 目录原样保留

### Requirement: Agent 粒度补齐安装
hub SHALL 支持把 SSOT 中已有技能补装到指定 Agent（`addPlacement(skill, target, {dedicated})`），语义与新安装一致（自动备份除外——补齐不改内容无需备份），并写入历史与操作日志。

#### Scenario: 一键补齐
- **WHEN** 技能已装于 Claude Code，用户对 Hermes 执行补齐
- **THEN** Hermes 出现该技能（按其共享支持度决定 shared/专属），原安装不受影响

### Requirement: GitLab 私服来源
来源 spec SHALL 接受完整 URL 形式 `https://<host>/<owner>/<repo>[#branch][:subdir]`（public 仓库，含私服 GitLab），tarball 经 `https://<host>/<owner>/<repo>/-/archive/<branch>/<repo>-<branch>.tar.gz` 获取；`owner/repo` 简写仍走 GitHub codeload。

#### Scenario: 添加私服 GitLab 来源
- **WHEN** 用户添加 `https://gitlab.corp.local/team/skills#main:packs`
- **THEN** 来源记录 provider=gitlab、host=gitlab.corp.local，可列出并安装其中技能

### Requirement: 操作日志
hub MUST 记录每次改变本地状态的操作（安装/补齐/同步/启停/卸载/回退/备份创建与删除/接管/存储与分发方式切换/来源与项目增删），含时间、动作、对象与影响摘要，全局保留最近 500 条。

#### Scenario: 操作可追溯
- **WHEN** 用户完成一次同步后查看操作记录
- **THEN** 记录中出现该同步条目（技能、目标数、时间）

### Requirement: 按 Agent 批量备份
hub SHALL 支持对指定 Agent 集合（多选或全选）一键备份其安装的全部技能（去重），逐技能生成快照备份记录（原因标注手动备份与 Agent 名），供后续按需恢复。

#### Scenario: 全选备份
- **WHEN** 用户勾选全部 Agent 执行备份
- **THEN** 所有已安装技能各生成一份备份记录并计入保留策略
