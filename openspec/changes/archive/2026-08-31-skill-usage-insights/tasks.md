# Tasks: skill-usage-insights

## 1. 采集内核（packages/hub/src/usage/）
- [x] 1.1 数据模型与存储：UsageEvent/游标/聚合类型、events-YYYY-MM.jsonl 追加写、id 哈希幂等、stats 重建；单测（幂等/重建/截断重扫）
- [x] 1.2 probe 注册表与调度入口：UsageProbe 接口、可用性探测、失败跳过语义、scanUsage() 汇总（返回各源新增数与错误）；单测
- [x] 1.3 claude-code probe：流式逐行解析 jsonl（Skill tool_use + cwd/timestamp 关联）、字节游标；fixture 表驱动单测
- [x] 1.4 opencode probe：node:sqlite 运行时探测 + readOnly 查询 part/session、时间水位游标；fixture 单测（含不可用跳过）
- [x] 1.5 codex probe：rollout jsonl 命令参数 SKILL.md 路径启发式 + SSOT 白名单过滤；fixture 单测
- [x] 1.6 HubState.usage_collection 开关字段（默认关闭）+ 一键清除 clearUsage()；单测

## 2. 桌面端
- [x] 2.1 主进程调度（启动/30min/手动 IPC）+ 主日志记录；IPC：usageScan/usageStats(skill?)/usageSettings/clearUsage
- [x] 2.2 设置：使用采集开关区（总开关/按 Agent/清除，隐私说明文案）
- [x] 2.3 技能详情使用分析区块（Agent 分布/次数/最近使用/项目分布/证据等级）+ 列表行轻量信号 + 未开启引导
- [x] 2.4 AI 评分/优化可选附带使用聚合摘要（明示内容概况）
- [x] 2.5 全部门禁（tsc/eslint/vitest/electron-vite build）
