# Audit: desktop-refinements-v3

## Before This Change

- `sharedDirSupport` 仅 Codex/OpenCode 为 true，其余 Agent 均按"不支持共享目录"处理，且 Pi/DeepSeek Harness 的专属全局目录路径与官方文档不符。
- placement 徽标用「通」「专」文字，且单态显示，无法同时呈现一个技能"既经共享目录分发、又有专属落点"。
- 社区开源视图平铺技能，无仓库折叠；点击无预览；github.com 完整 URL 添加来源时 label 带 `github.com/` 前缀异常。
- 技能查看器预览即原文（无 Markdown 渲染），二进制素材在文件树中完全不可见、无法预览。
- 无应用场景分析能力；AI 服务仅有配置与测试，无使用日志与费用信息。
- 桌面端无卸载入口（hub 层已有 uninstall 能力但未暴露 UI）。

## Gaps Identified

- Hermes 对 home 级 `~/.agents/skills` 属 opt-in（需 `skills.external_dirs` 配置），与用户"除 Claude 外均支持"的假设有出入 → 保守维持 false，注释记录证据。
- 远端（未安装）社区技能没有拉取单文件的 IPC，只读预览对未安装技能降级为元信息展示。
- custom 服务商无单价表 → 费用记 null，UI 显示"—"，仅累计 tokens。
- `readSkillFiles` 原本静默丢弃二进制文件，使素材预览的 spec 场景无法成立 → 契约调整为以 `binary: true` 空内容条目列出（超限文件同），旧单测按新契约更新。

## Implemented Contract

- **hub**：`state.scenarios`（指纹绑定的场景分析持久化，最后落点卸载时清理）；`fingerprintOf`/`getScenario`/`saveScenario`；`readSkillAsset`（base64+mime，5MB 上限，防穿越）；github.com URL 来源不存 `host`；`sharedDirSupport` 按 2026-08 官方文档核实（claude-code/hermes false，其余 6 家 true），Pi 专属目录改 `.pi/agent/skills`、DeepSeek Harness 改 `.dsh/skills`（项目级 `.agents/skills`）。
- **skill-core/contract**：`SCENARIO_SYSTEM_PROMPT`（业务/岗位/场景/工具四类标签 + ≤120 字概要）；`aiScenarioRawSchema`、`aiUsageEntrySchema`。
- **desktop main**：AI 用量日志（每次 chat 捕获 usage，单价表 gpt-4o/gpt-4o-mini/gpt-4.1-mini/deepseek-chat/deepseek-reasoner，200 条持久化 `ai-usage.json`）；IPC 新增 `aiScenario(skill, force?)`（指纹缓存 + stale 判定）、`aiUsage()`、`readSkillAsset`；snapshot 携带 `scenarios`。
- **renderer**：placement 双态记号（绿点=通用/橄榄方块=专属，双态并存 + 悬浮路径说明，无「专」字）；社区按仓库折叠 + 只读预览弹窗；Markdown 渲染预览（marked + 净化）/原文编辑切换；二进制素材内联预览（图片/PDF/其他降级）；场景分析面板（标签分组 + 概要 + 过期提示 + 强制重生成）与列表行标签摘要；AI tab 使用日志与累计费用；卸载弹窗（整技能 / 按 Agent 落点，确认 + 自动备份提示）；设置行小字移除。
- 测试：hub 51、skill-core 37 全绿；全仓 vitest 128 passed；tsc/eslint/electron-vite build 通过；Linux deb/AppImage 已重打（artifacts/）。
