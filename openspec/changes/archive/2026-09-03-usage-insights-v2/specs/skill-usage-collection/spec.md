# skill-usage-collection

## ADDED Requirements

### Requirement: 使用明细与会话查询

UsageStore SHALL 提供事件明细查询（可按 skill、agent、session_id 过滤，按发生时间倒序，支持 limit）与会话聚合查询（按 agent+session_id 分组，含 project_dir、first_at/last_at、事件总数、按技能的次数分布；可按 skill/agent 过滤，按最近活动倒序）。查询 MUST 只读，不影响游标与采集。

#### Scenario: 按技能查会话分布

- **WHEN** 技能 foo 在会话 s1（3 次）与 s2（1 次）中被使用，查询 sessions({skill:'foo'})
- **THEN** 返回两个会话条目，各含 agent、project_dir、起止时间与 foo 的次数，按最近活动倒序

#### Scenario: 事件明细分页倒序

- **WHEN** 存在 10 条 foo 事件，查询 events({skill:'foo', limit:5})
- **THEN** 返回最近 5 条，按 occurred_at 倒序
