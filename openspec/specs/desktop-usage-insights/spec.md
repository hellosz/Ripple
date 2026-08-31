# desktop-usage-insights Specification

## Purpose
TBD - created by archiving change skill-usage-insights. Update Purpose after archive.
## Requirements
### Requirement: 采集调度与操作日志

桌面主进程 SHALL 在采集开启时于应用启动、每 30 分钟以及用户手动刷新时执行增量扫描；每次扫描完成 SHALL 记录操作日志主日志（新增事件数、扫描源数、耗时），扫描失败的源以细分信息计入且不中断整体。

#### Scenario: 手动刷新记录日志

- **WHEN** 用户在使用分析界面点击刷新且本次新增 5 条事件
- **THEN** 扫描完成后操作记录中出现一条主日志（含新增 5 条与扫描源统计）

### Requirement: 使用分析展示

技能详情 SHALL 展示该技能的使用分析：被哪些 Agent 使用、总次数、最近使用时间、项目分布、证据等级标注（结构化/路径启发）；技能列表行 SHALL 展示轻量使用信号（如最近 30 天次数）。未开启采集时 SHALL 展示引导开启的说明而非空数据。

#### Scenario: 查看技能使用分析

- **WHEN** 采集已开启且技能 foo 有 claude-code 12 次、codex 3 次事件
- **THEN** foo 详情显示两个 Agent 的次数、最近使用时间与项目分布，codex 条目带"路径启发"证据标注

### Requirement: 设置开关与数据清除

设置界面 SHALL 提供使用采集总开关、按 Agent 开关与一键清除；开关状态持久化于 hub state。清除 SHALL 删除全部事件、游标与聚合缓存并记操作日志。

#### Scenario: 关闭后停止采集

- **WHEN** 用户关闭采集总开关
- **THEN** 定时扫描停止，后续启动不再读取 transcript，已有数据保留直至用户主动清除

### Requirement: AI 上下文注入

AI 评分与优化 SHALL 可选附加该技能的使用聚合摘要（次数、agent 分布、项目分布、最近趋势；不含对话正文）；注入前 UI MUST 明示将发送的摘要内容概况。无使用数据时行为与现状一致。

#### Scenario: 评分附带使用摘要

- **WHEN** 用户对有使用数据的技能执行 AI 评分且勾选"附带使用摘要"
- **THEN** 请求的用户消息包含聚合统计段落且不含任何 transcript 原文

