# Design: desktop-refinements

## Context
真机验证反馈批次。关键外部事实（调研）：`~/.agents/skills` 为 agentskills.io 跨客户端共享约定；Codex 以其为主目录，OpenCode/Gemini CLI/Antigravity 原生支持；Claude Code、Cursor 仅读私有目录。

## Decisions
- **placement 模型**：InstallRecord.mode 增加 `shared`；`distributeTo(skill, target, {dedicated})`——storage=shared 且 adapter.sharedDirSupport 且未强制 dedicated 时记 shared、零分发。禁用开关对 shared placement 不适用（UI 以「通用」标签呈现，卸载=移除记录）。
- **所有权**：state.owned（skill→true），writeSkillContent 时登记；uninstall 最后一处仅 owned 才删 SSOT。修复"共享目录内容误删"级联风险的最后一环。
- **默认存储切换为 shared**：defaultState 变更；既有 state 不迁移（尊重用户现状）。
- **GitLab tarball**：SourceRepo 增加 provider/host；URL spec 解析；`/-/archive/<branch>/<repo>-<branch>.tar.gz`（public 无需鉴权）。tar 首段目录名 gitlab 为 `<repo>-<branch>`，与 github 一致按"去首段"处理。
- **logo**：renderer 内置 simple-icons 的 anthropic/openai/opencode/deepseek 等 path 数据（构建期依赖，无运行时外链，符合 CSP）；无图标的 Agent 用品牌色字母块。
- **操作日志**：state.oplog 环形上限 500；hub 内部 `logOp()` 统一埋点。
- **头图**：用户提供的 avif 复制入 renderer assets，构建期打包（data 引用），连接卡与登录弹窗共用。

## Risks / Trade-offs
- [shared placement 下无法逐 Agent 禁用] → UI 明示「通用」；需要独立控制时走 dedicated 个性化。
- [simple-icons 无 Hermes/OpenClaw/Pi/Cursor 官方图标] → 字母块兜底，后续可换官方资源。
