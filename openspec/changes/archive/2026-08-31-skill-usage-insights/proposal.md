# Proposal: skill-usage-insights

## Why

用户维护着几十个本地技能，但完全看不到"哪些技能真的被用了"：不知道某技能被哪些 Agent 使用过、在什么项目/场景下触发、频率如何。这导致两类问题：一是无法判断哪些技能值得持续维护、哪些该淘汰；二是已有的 AI 评分/优化功能缺少真实使用上下文，建议脱离实际。

调研（2026-08-31，本机实测）确认：Claude Code（`~/.claude/projects/**/*.jsonl` 中的 `Skill` 工具调用）与 OpenCode（`opencode.db` 的 `skill` 工具记录）留有**结构化**使用证据；Codex（rollout jsonl 中读取 SKILL.md 路径）可**启发式**辨认；OpenClaw/DeepSeek Harness/Hermes 仅部分可行，Cursor/Pi 首期不做。

## What Changes

- hub 新增 usage 采集内核：per-Agent 的 usage probe 注册表（与 AGENT_ADAPTERS 同构，新增 Agent 只加注册表条目）、增量游标、幂等事件存储（`~/.ripple/usage/` JSONL 分月分片 + 聚合缓存）。
- 首期 probe：claude-code（结构化）、opencode（结构化，依赖 `node:sqlite`，运行时探测不可用则跳过）、codex（路径启发式）；每条事件带证据等级。
- 隐私：采集默认**关闭**（opt-in），默认只存元数据（技能/agent/时间/项目/会话/证据等级），提供按 Agent 开关与一键清除。
- 桌面端：设置中的采集开关；技能详情/列表新增使用分析展示（被哪些 Agent 用过、次数、最近使用、项目分布、证据等级）；扫描任务（启动 + 30 分钟定时 + 手动）记操作日志（主日志+游标推进细分）。
- AI 集成:评分/优化的输入可附加该技能的使用聚合摘要（仅聚合统计,不含对话正文），UI 明示将发送的内容。

## Capabilities

- `skill-usage-collection`：hub 层采集内核（probe 注册表、游标、事件存储、隐私开关、聚合统计）。
- `desktop-usage-insights`：桌面调度、设置开关、使用分析视图、AI 上下文注入。

## Impact

- 新增 `packages/hub/src/usage/`；`HubState` 增加采集开关字段（前向兼容补齐）。
- `apps/desktop` 主进程新增调度与 IPC；renderer 新增使用分析 UI。
- 不改服务端；不上传任何使用数据到 Ripple 服务或第三方（AI 摘要注入除外且明示）。
- 读取各 Agent 私有格式，格式变更风险由"失败即跳过 + 证据等级"缓释。
