# Proposal: skill-ai

## Why
希望在本地对技能做质量把关与改进：基于官方规范的技术评分、可执行的业务/技术优化建议（token 精简、渐进式披露、防误唤醒的命名与描述），并以 git 风格 diff 预览与一键应用。

## What Changes
- **多服务商 AI 配置**（设置新增 tab）：OpenAI、DeepSeek 必选支持 + 自定义 OpenAI 兼容服务商（baseUrl/model/apiKey，key 用 safeStorage 加密存储，主进程调用）。
- **SKILL 评分**：按调研产出的维度 rubric（触发精准度/渐进式披露/token 效率/结构完整/可执行性等）单次 LLM 调用结构化输出（总分/等级/分维度理由），技能详情内展示。
- **SKILL 优化**：技能行/详情新增「优化」按钮，输出业务+技术建议清单与可落盘 patches；**git 风格 diff 对比**（优化前后），支持一键应用（走编辑器后端写回）与放弃。
- 失败兜底：非法 JSON 重试、code fence 剥离、超时与错误 toast。

## Capabilities
### Modified Capabilities
- `desktop-client`: AI 设置、评分展示、优化 diff 工作流。

### New Capabilities
- `skill-ai-review`: 评分维度契约、优化输出契约、服务商抽象。

## Impact
apps/desktop（main：AI 调用与配置存储；renderer：设置/评分/diff UI）；prompt 与维度契约沉淀在 desktop main（后续可上移共享包供 CLI 复用）。
