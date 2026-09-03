# Proposal: usage-insights-v2

## Why

使用分析目前只有 skill × agent 的次数聚合：技能详情只能看到"共 N 次、最近时间、项目 ×次数"，无法回答"在哪个会话里、什么时候、和哪些技能一起被使用"；也没有一个全局视角按 Agent/会话组织地查看技能使用情况。

## What Changes

- hub UsageStore 新增明细查询：`events(filter)`（按 skill/agent/session 过滤、时间倒序、分页）与会话聚合 `sessions(filter)`（agent+session 分组：项目、起止时间、事件数、技能分布）。
- 桌面 IPC：`usageEvents` / `usageSessions`。
- 全局入口：侧边栏「使用分析」视图——按 Agent 分组的会话列表（时间倒序，含项目、时长跨度、技能 chips），会话可展开查看该会话内技能使用明细；顶部汇总与技能/Agent 过滤。
- 技能详情「使用」区块升级：Agent 分布之外，新增该技能的会话明细（最近 N 个会话：agent、项目、时间、该会话内次数）与最近事件时间线。

## Capabilities

- `skill-usage-collection`：明细/会话查询接口。
- `desktop-usage-insights`：全局使用分析视图与技能详情明细。

## Impact

- `packages/hub/src/usage/store.ts` 查询能力（读侧，纯函数式扩展）；desktop IPC + renderer 新视图。事件数据模型不变，无迁移。
