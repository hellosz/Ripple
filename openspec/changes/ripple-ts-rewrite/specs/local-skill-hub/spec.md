# local-skill-hub

## ADDED Requirements

### Requirement: SSOT 中心存储
本地技能 MUST 统一存放于中心存储目录（SSOT）：默认内置 `~/.ripple/skills/`，可切换为共享 `~/.agents/skills/`。切换存储位置时系统 MUST 平滑迁移（复制内容 → 重建全部分发链接 → 清理旧位置），安装状态与启用状态不丢失。

#### Scenario: 切换到共享目录
- **WHEN** 用户把存储位置从内置切换为共享目录
- **THEN** 所有技能内容迁至新目录，各 Agent 目标目录的链接指向新位置，启用/禁用状态保持不变

### Requirement: 状态持久化
安装状态（技能 × Agent × 作用域[全局/项目] × 版本 × 启用与否）、项目目录列表、来源仓库与设置 MUST 持久化于状态文件（如 `~/.ripple/state.json`），写入 MUST 原子（临时文件 + rename），损坏时可从目录扫描重建。

#### Scenario: 断电后状态可用
- **WHEN** 写状态过程中进程被杀
- **THEN** 下次启动读取到的仍是完整合法的旧状态或新状态，绝不是半写文件

### Requirement: 分发方式：symlink 与复制
从 SSOT 到各 Agent/项目目录的分发 SHALL 支持两种方式：symlink（默认推荐；Windows 上目录优先 junction）与文件复制。symlink 创建失败时 MUST 自动降级为复制并向用户明示当前实际方式。切换分发方式 MUST 重建所有既有分发。

#### Scenario: Windows 无 symlink 权限
- **WHEN** 在未开启开发者模式的 Windows 上安装技能且 junction 创建失败
- **THEN** 该分发自动使用文件复制完成，界面/输出标注"复制模式"

### Requirement: Agent 适配器
系统 SHALL 通过声明式适配器注册表支持多 Agent（内置：Claude Code `~/.claude/skills`、Codex `~/.codex/skills`、OpenCode `~/.opencode/skill`、Cursor `~/.cursor/skills` 等），每个适配器声明全局目录、项目内相对目录与检测逻辑。未检测到的 Agent MUST 仍可见但标记未检测。新增 Agent 支持 MUST 只需增加适配器条目而不修改核心逻辑。

#### Scenario: 检测本机 Agent
- **WHEN** 本机存在 `~/.claude/skills` 而无 `~/.codex`
- **THEN** Claude Code 显示为已检测，Codex 显示为未检测（置灰）

### Requirement: 项目目录管理
用户 SHALL 能添加/移除项目目录；技能可按"项目作用域"安装到项目内的 Agent 目录（如 `<project>/.claude/skills/`）。项目作用域安装 MUST 与全局安装独立管理（独立版本与启用状态）。

#### Scenario: 安装到项目
- **WHEN** 用户将技能安装到项目 ripple-web 的 Claude Code 作用域
- **THEN** `<ripple-web>/.claude/skills/<name>` 出现分发，且全局安装不受影响

### Requirement: 扫描与版本一致性
系统 SHALL 支持扫描 Agent 目录与项目目录：发现非 hub 管理的既有技能（识别为 unmanaged 并可导入接管），并检测同一技能多处安装版本不一致。存在不一致时 MUST 能一键统一到最新版本。

#### Scenario: 版本不一致检测与统一
- **WHEN** 某技能在 Claude Code 全局为 v1.2.0、Codex 全局为 v1.1.0
- **THEN** 系统标记该技能"版本不一致"，执行统一后两处均为最新版

### Requirement: 启用/禁用/卸载
每处安装 SHALL 支持独立启用/禁用（禁用 = 移除目标目录分发但保留 SSOT 内容与状态；启用 = 重建分发）与卸载（移除该处分发与安装记录；最后一处卸载后 SSOT 内容仍保留于备份）。

#### Scenario: 禁用单处安装
- **WHEN** 用户禁用某技能在 OpenCode 全局的安装
- **THEN** `~/.opencode/skill/<name>` 被移除，其他 Agent 的安装不变，重新启用后恢复

### Requirement: 同步到多目标
系统 SHALL 支持将某技能一次同步到多个目标（Agent × 作用域勾选集合）：勾选的目标统一安装/升级到指定版本，未勾选的既有目标被移除。执行前 MUST 自动创建备份。

#### Scenario: 同步收敛安装矩阵
- **WHEN** 用户在同步操作中勾选 Claude Code 全局与项目 ripple-web，取消 Codex 全局
- **THEN** 前两处为目标版本，Codex 处被卸载，操作记入历史

### Requirement: 自动备份与保留策略
更新、同步、卸载操作前系统 MUST 自动将当前版本打包备份到 `~/.ripple/backups/<name>/`，备份记录含技能、版本、原因、大小与时间；全局保留最近 20 份，超出按最旧清理。用户 SHALL 能浏览、恢复与删除备份（删除不可恢复，需确认）。

#### Scenario: 超出保留数量
- **WHEN** 第 21 份备份创建
- **THEN** 最旧的一份被自动清理，其余 20 份保留

#### Scenario: 从备份恢复
- **WHEN** 用户对某备份执行恢复
- **THEN** SSOT 内容回到该版本、所有分发重建、历史记录新增一条"回退"

### Requirement: 操作历史与回退
每个技能 SHALL 维护操作历史时间线（安装/更新/同步/回退，含版本、目标描述与时间）；历史中的任意非当前版本 MUST 可回退（基于对应备份）。

#### Scenario: 回退到历史版本
- **WHEN** 用户在历史中对 v1.1.0 点击"回退到此版本"
- **THEN** 该技能全部安装位置回到 v1.1.0，时间线顶部出现回退记录

### Requirement: 多来源安装
系统 SHALL 支持三类安装来源：① Ripple 服务（registry API + ZIP 下载，需登录）；② GitHub 仓库（owner/repo + 分支 + 可选子目录，经 tarball 下载扫描含 SKILL.md 的目录，无需 git 二进制）；③ 本地 ZIP 导入。②③ MUST 在未登录的本地模式可用。所有来源落盘前 MUST 经 skill-package-spec 校验。来源仓库可添加/移除；移除仓库时已装技能保留但不再更新。

#### Scenario: 未登录从 GitHub 仓库安装
- **WHEN** 未登录用户添加仓库 `anthropics/skills` 并安装其中一个技能
- **THEN** 安装成功进入 SSOT 并可分发到 Agent

#### Scenario: 移除来源仓库
- **WHEN** 用户移除某自定义仓库
- **THEN** 由其安装的技能保留在本地，但更新检查不再包含该仓库

### Requirement: 纯 Node 实现
hub 核心的压缩/解压、下载、链接操作 MUST 以纯 Node/TS 实现，不依赖系统 `zip`/`unzip`/`git` 可执行文件，保证三平台行为一致。

#### Scenario: 无 unzip 的最小环境
- **WHEN** 在未安装 zip/unzip 的裸 Windows 上执行安装
- **THEN** 安装流程正常完成
