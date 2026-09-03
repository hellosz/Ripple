# desktop-usage-insights

## ADDED Requirements

### Requirement: 全局使用分析视图

桌面 SHALL 提供「使用分析」一级入口：按 Agent 分组展示会话列表（时间倒序，含项目、时间跨度、事件数、技能 chips），会话可展开查看会话内各技能的使用明细；顶部展示汇总（总次数/会话数/覆盖技能数）并支持按 Agent 与技能过滤。未开启采集时 SHALL 展示引导。

#### Scenario: 按会话查看使用情况

- **WHEN** 采集已开启且 claude-code 有会话 s1 使用了 diagram-design ×2、opsx-apply ×1
- **THEN** 使用分析视图中 Claude Code 分组下出现 s1 条目（项目、时间、3 次），展开后列出两项技能及次数

### Requirement: 技能详情使用明细

技能详情「使用」区块 SHALL 在 Agent 分布之外展示该技能的会话明细（最近会话：agent/项目/时间/该会话内次数）与最近事件时间线（时间 + agent + 项目）。

#### Scenario: 技能会话明细

- **WHEN** 打开 diagram-design 详情「使用」且其在 2 个会话中共 3 次使用
- **THEN** 区块内列出 2 个会话条目及各自次数，与最近事件的时间线
