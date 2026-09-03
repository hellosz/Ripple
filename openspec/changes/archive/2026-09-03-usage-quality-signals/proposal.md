# Proposal: usage-quality-signals

## Why

使用分析已能回答"被用了多少次、在哪些会话"，但回答不了"这个技能质量如何、该怎么优化"：触发是自动匹配还是用户手动救场？加载后 references/scripts 有没有被真的用起来（渐进式披露是否失效）？哪些技能该淘汰？这些是持续优化技能的核心依据。

## What Changes

- **事件模型扩展（向后兼容，可选字段）**：`trigger?: 'auto' | 'manual'`（claude-code：Skill 工具调用=auto，slash 命令=manual；其他 Agent 缺省不填）；`resource?: 'skill' | 'reference' | 'script'`（缺省视为 skill 触发）。
- **probe 扩展**：claude-code 识别 slash 手动触发与 references/scripts 路径访问；codex/dsh 的路径正则扩展到 `references/`、`scripts/` 子路径（resource 标注）。
- **聚合口径**：stats/sessions 的"使用次数"只计触发事件（resource 缺省或 skill）；resource 事件用于跟随度。
- **质量信号聚合** `qualitySignals()`：按技能输出——触发数、手动占比、单会话重复加载会话数、共现 Top、最近使用/陈旧天数（含"已安装从未使用"）、references/scripts 跟随率（有跟随的会话数 / 触发会话数）、派生建议标签（触发失灵 / 死重 references / 淘汰候选 / token 冗长嫌疑）。
- 桌面：「使用分析」视图新增「质量信号」子视图（技能表 + 建议标签）；AI 评分/优化的使用摘要注入附带质量信号。

## Capabilities

- `skill-usage-collection`：事件字段与 probe 扩展、质量聚合。
- `desktop-usage-insights`：质量信号展示与 AI 上下文注入。

## Impact

- hub usage 模块与三个 probe；desktop IPC/renderer。旧事件无新字段按缺省语义解释，无迁移。
