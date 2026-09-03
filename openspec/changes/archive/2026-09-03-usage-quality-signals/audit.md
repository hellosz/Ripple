# Audit: usage-quality-signals

## Before This Change

- 使用数据只有"次数/会话"，无法判断技能质量：分不清自动触发与手动救场，看不到 references/scripts 是否被真的用起来，没有淘汰/优化依据。

## Gaps Identified

- 触发方式仅 Claude Code 可靠可辨（Skill 工具 vs command-name）→ manual 检测走 SSOT 白名单精确匹配，宁漏勿误；其他 Agent 缺省不标注，manual_ratio 分母只算有标注的事件。
- "死重 references" 需知道技能是否真有 references 目录 → qualitySignals 增加 withReferences 参数，由桌面侧从 skillDir 计算。
- scripts 执行与阅读无法启发式区分 → 统一计"跟随访问"。
- 使用次数口径若混入跟随事件会失真 → stats/sessions 只计触发事件（resource 缺省或 skill）。

## Implemented Contract

- **事件模型**：UsageEvent 可选 `trigger`（auto/manual）与 `resource`（skill/reference/script），旧事件按缺省语义解释，零迁移；claude-code probe 标注 auto/manual 并产 references/scripts 跟随事件（path-heuristic），codex/dsh 路径正则扩展子资源。
- **聚合**：`qualitySignals(installed, {withReferences})` —— 触发数/手动占比/触发会话数/重复加载会话数/共现 Top3/最近使用与陈旧天数（含从未使用）/references/scripts 跟随率 + 四类表驱动标签（触发失灵 ≥50% 手动且 ≥4 次；死重 references 有目录且 ≥3 会话零跟随；淘汰候选 ≥90 天或从未使用；token 冗长嫌疑重复加载会话占比 ≥30% 且 ≥3 会话）。
- **desktop**：IPC `usageQuality`；「使用分析」新增「质量信号」子视图（小结 + 表格 + 标签 tooltip 建议动作 + 展开共现）；技能详情「使用」头部标签行；AI 评分/优化使用摘要注入质量信号（手动占比/跟随率/重复加载）。
- 测试与门禁：hub 87 测（新增 auto/manual/跟随/口径与四标签场景）、全仓 164 测、tsc/eslint/electron-vite build 全绿。
