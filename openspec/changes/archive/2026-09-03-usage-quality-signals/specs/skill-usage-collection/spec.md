# skill-usage-collection

## ADDED Requirements

### Requirement: 触发方式与资源访问标注

claude-code probe SHALL 区分触发方式：`Skill` 工具调用标注 `trigger='auto'`，用户消息中的 slash 命令（command-name 与本地技能名匹配）标注 `trigger='manual'`；其他 Agent 缺省不标注。probe SHALL 识别技能内 `references/`、`scripts/` 子路径访问并以 `resource='reference'|'script'` 产出跟随事件（技能名过 SSOT 白名单）；触发事件 resource 缺省。stats/sessions 的使用次数 MUST 只计触发事件，跟随事件仅用于跟随度。

#### Scenario: 手动与自动触发区分

- **WHEN** transcript 中同一技能既有 Skill 工具调用又有用户 slash 调用
- **THEN** 产出两条事件分别标注 auto 与 manual，使用次数计 2

#### Scenario: references 跟随事件不计入使用次数

- **WHEN** 会话中技能 foo 触发 1 次且其 references/guide.md 被读取 1 次
- **THEN** foo 使用次数为 1，跟随事件 resource='reference' 存在于明细中

### Requirement: 质量信号聚合

hub SHALL 提供 `qualitySignals(installedSkills)` 聚合：按技能输出触发总数、手动触发占比、发生重复加载的会话数、共现技能 Top3、最近使用时间与陈旧天数（已安装但无任何事件的技能也 MUST 出现，标记从未使用）、references/scripts 跟随率（有对应跟随事件的触发会话数 / 触发会话总数）；并 SHALL 派生建议标签：手动占比 ≥ 0.5 且触发 ≥ 4 → 触发失灵；有 references 但跟随率为 0 且触发 ≥ 3 → 死重 references；≥ 90 天无触发或从未使用 → 淘汰候选；重复加载会话占比 ≥ 0.3 且触发会话 ≥ 3 → token 冗长嫌疑。

#### Scenario: 触发失灵标签

- **WHEN** 技能 foo 触发 6 次其中 4 次 manual
- **THEN** qualitySignals 中 foo 的 manual_ratio≈0.67 且含「触发失灵」标签

#### Scenario: 从未使用的已安装技能

- **WHEN** 技能 bar 已安装但无任何使用事件
- **THEN** qualitySignals 包含 bar，标记从未使用并含「淘汰候选」标签
