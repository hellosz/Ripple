# skill-ai-review（delta）

## ADDED Requirements

### Requirement: 应用场景分析
系统 SHALL 支持对任意本地技能生成应用场景分析：业务（business）/ 岗位（role）/ 场景（scene）/ 工具（tool）四类标签（各 1-6 个）与不超过 120 字概要；结果 MUST 持久化本地并记录生成时的内容指纹，指纹变化时 UI 提示可重新分析；LLM 不可用时给出明确错误（不做降级捏造）。

#### Scenario: 生成并持久化
- **WHEN** 用户对某技能执行场景分析
- **THEN** 得到四类标签与概要，重启应用后仍可见，无需重复调用

### Requirement: AI 使用日志与费用
每次 AI 调用（评分/优化/场景分析/连接测试）MUST 记录：时间、功能、模型、输入/输出 tokens、估算费用（内置 openai/deepseek 单价表；custom 服务商仅记 tokens 不估价）；设置-AI tab MUST 展示调用日志（倒序）与累计费用，日志本地保留最近 200 条。

#### Scenario: 查看用量
- **WHEN** 用户执行若干次 AI 功能后打开 设置 → AI 服务商
- **THEN** 可见每次调用的 tokens 与费用及累计合计
