# Audit: usage-insights-v2

## Before This Change

- 使用分析只有 skill × agent 次数聚合：技能详情仅显示"共 N 次 + 项目 ×次数"，无法看到会话粒度；无全局入口按 Agent/会话组织查看。

## Gaps Identified

- 事件明细已在 JSONL 分片中完整存在（session_id/project_dir/occurred_at/evidence 齐备），缺的只是读侧查询与展示——零数据模型变更即可交付。
- 会话聚合带 skill 过滤时 skills 分布只含该技能（语义上是"该技能在此会话的次数"），已在单测固化。

## Implemented Contract

- **hub**：`UsageStore.events(filter)`（skill/agent/session 过滤、occurred_at 倒序、limit）与 `sessions(filter)`（agent+session 分组：project_dir、first_at/last_at、count、skills 分布，按最近活动倒序）；UsageCollector 透出；85 测全绿（新增 2 组查询用例）。
- **desktop**：IPC `usageEvents`/`usageSessions`；「使用分析」一级视图（汇总条、Agent/技能过滤、Agent 分组会话列表、会话展开明细时间线、未开启引导、重新扫描）；技能详情「使用」区块升级（Agent 分布 + 最近 5 会话明细 + 最近 8 事件时间线 + 跳转全局视图带技能过滤）。
- 门禁：全仓 162 测、tsc/eslint/electron-vite build 全绿；Linux 包已重打。
