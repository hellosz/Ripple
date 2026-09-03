# Tasks: usage-quality-signals

## 1. hub
- [x] 1.1 类型：UsageEvent.trigger?/resource?；stats/sessions 口径改为只计触发事件；单测
- [x] 1.2 claude-code probe：Skill tool_use 标 auto、command-name 匹配白名单标 manual、Read/Bash 中 references|scripts 路径产跟随事件；fixture 单测
- [x] 1.3 codex/dsh probe：路径正则扩展 references|scripts 并标 resource；单测
- [x] 1.4 qualitySignals(installed)：聚合 + 建议标签（表驱动阈值）；单测（各标签场景 + 从未使用）
- [x] 1.5 desktop IPC usageQuality + AI 使用摘要注入质量信号

## 2. renderer
- [x] 2.1 「使用分析」视图新增「质量信号」子视图（技能表：触发/手动占比/跟随率/最近使用/标签；标签 tooltip 解释与建议动作）
- [x] 2.2 技能详情「使用」区块附质量标签行
- [x] 2.3 门禁全绿 + 重打 Linux 包
