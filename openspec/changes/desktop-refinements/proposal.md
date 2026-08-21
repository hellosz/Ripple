# Proposal: desktop-refinements

## Why

桌面客户端首轮真机验证（2026-08-21）暴露一批体验与能力缺口：登录态面板溢出且显示邮箱、Agent 列表噪音大无品牌识别、技能行折叠交互多余且按钮文案截断、共享技能标准（agentskills.io 的 `~/.agents/skills`）未被利用导致重复分发、GitHub 来源没有技能浏览入口、缺少操作审计与按 Agent 批量备份。

## What Changes

- 侧边栏连接卡重构：原型头图背景、登录后显示**昵称**、修复溢出；Agent 列表按固定顺序（Claude Code → Codex → OpenCode → Hermes → OpenClaw → Pi → 其余）排序，无技能 Agent 折叠收纳；Agent 显示官方 logo（simple-icons + 品牌色字母兜底）。
- 技能行去掉展开/折叠，改为常显 **Agent 存在矩阵**：每个 Agent 一个 logo 徽标，区分「通用」（经 `~/.agents/skills` 共享标准引入）与「专属」（分发进 Agent 私有目录）；未装的可一键**补齐**（Agent 粒度安装）；按钮文案改为「同步」，「历史」移到其后。
- **共享标准支持**：适配器标注 `sharedDirSupport`（Codex/OpenCode 原生读共享目录，依据 agentskills.io）；默认存储位置改为共享 `~/.agents/skills`（安装即复用）；对支持共享的 Agent 不再重复分发（placement=shared），Agent 粒度个性化仍可强制专属分发；SSOT 增加**所有权跟踪**——只删除 hub 自己写入的技能目录（防再次伤及其他工具内容）。
- 来源扩展：支持**私服 GitLab public 仓库**（粘贴 `https://host/owner/repo[#branch][:subdir]`，走 `/-/archive` tarball）；设置页每个来源增加「浏览技能」入口（列出仓库内技能并可安装）。
- **操作记录**：hub 记录每次本地操作（安装/同步/启停/卸载/回退/来源与设置变更等）的全局日志，设置页新增「操作记录」tab。
- 备份管理增强：支持**按 Agent 多选/全选一键备份**其全部技能，形成可按需恢复的备份记录。

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `local-skill-hub`: 共享目录 placement 语义（sharedDirSupport/默认 shared 存储/所有权跟踪）、GitLab 来源、操作日志、按 Agent 批量备份、Agent 粒度补齐安装。
- `desktop-client`: 连接卡/Agent 列表/技能行存在矩阵/来源浏览/操作记录/批量备份 UI 调整。

## Impact

- `packages/hub`（核心语义扩展 + 迁移安全）、`apps/desktop`（shared api + renderer 大改）、CLI 复用 hub 新语义（来源 URL 解析自动生效）。
- 兼容性：既有 state.json 的 storage_location 保持不变；新装用户默认 shared。
