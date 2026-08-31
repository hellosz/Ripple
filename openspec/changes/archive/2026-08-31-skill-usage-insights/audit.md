# Audit: skill-usage-insights

## Before This Change

- 完全看不到技能的真实使用情况：不知道被哪些 Agent 用过、频率、项目分布；AI 评分/优化没有使用上下文。
- 各 Agent 的 session/transcript 散落本机且格式各异，无任何采集机制。

## Gaps Identified

- transcript 是私有格式且含完整对话内容 → 采集默认关闭（opt-in），事件只存元数据（技能/agent/时间/项目/会话/证据等级），提供按 Agent 开关与一键清除。
- `node:sqlite` 需 Node ≥22.5 与 CLI Node ≥20 冲突 → opencode probe 运行时探测，不可用即跳过；事件存储用 JSONL 分月分片而非 sqlite。
- codex 只有路径启发式证据 → SSOT 白名单过滤 + evidence 等级在 UI 标注（「路径启发」vs「工具调用」）。
- Cursor/Pi/Hermes/OpenClaw/DSH 证据不足或格式待验证 → 首期不做，probe 注册表可增量扩展（设计已留 DSH zstd 多帧陷阱记录）。

## Implemented Contract

- **hub `usage/`**：UsageEvent/游标/聚合类型；UsageStore（events-YYYY-MM.jsonl 追加、sha256 前 16 hex 事件 id 幂等去重、stats.json 缓存损坏可重建、clear 全清）；readJsonlIncrement 流式字节游标（size 变小截断重扫）；probe 注册表（claude-code 结构化 Skill tool_use / opencode node:sqlite readOnly + 时间水位 / codex 路径启发式+白名单）；UsageCollector.scanAll（enabled=false 不触任何文件、按 Agent 单禁、单 probe 失败不阻塞）。12 个单测含脱敏 fixture。
- **HubState** 新增 `usage_collection`（默认关闭，前向兼容补齐）；`setUsageCollection` 记操作日志。
- **desktop**：调度（启动 10s 后 + 30 分钟定时 + 手动），扫描完成记主日志（新增条数/源数/耗时）；IPC usageScan/usageStats/usageSettings/usageClear；设置「使用分析」区（总开关+隐私说明+按 Agent 开关+立即扫描+两次确认清除）；技能详情「使用」区块（Agent 分布/次数/最近使用/项目前 3/证据徽标，未开启引导）；列表行「N 次使用」轻量信号（单次 IPC 聚合）；AI 评分/优化「附带使用统计」勾选（明示仅聚合元数据），主进程注入聚合摘要且缓存键含摘要哈希。
- 测试与门禁：hub 74 测全绿（含 usage 12）、全仓 151 测、tsc/eslint/electron-vite build 通过。
