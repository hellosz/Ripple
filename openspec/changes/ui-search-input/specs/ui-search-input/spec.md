## ADDED Requirements

### Requirement: 搜索框默认态具备主操作感
系统 SHALL 让首页搜索框在默认态具备足够的高度与边框对比，并通过 hover/focus 反馈明确其可交互性。

#### Scenario: 默认态边框清晰
- **WHEN** 首页搜索框渲染
- **THEN** 搜索框边框对比明显（≥20% 白），高度不低于原默认（≥48px）

#### Scenario: 交互有反馈
- **WHEN** 用户悬停或聚焦搜索框
- **THEN** 搜索框边框或背景增强，聚焦时边框呈现品牌色高亮
