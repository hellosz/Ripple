# skill-ai-review

## ADDED Requirements

### Requirement: 多服务商 AI 配置
系统 MUST 支持 OpenAI、DeepSeek 与自定义 OpenAI 兼容服务商（baseUrl/model/apiKey）；apiKey MUST 加密存储（safeStorage），调用仅发生在主进程。

#### Scenario: 切换服务商
- **WHEN** 用户配置 DeepSeek 并保存
- **THEN** 后续评分/优化调用发往 DeepSeek，key 不以明文落盘

### Requirement: SKILL 评分
系统 SHALL 按规范调研产出的维度 rubric 对技能单次 LLM 调用评分，输出总分、等级与分维度得分及理由；输入按裁剪策略控制规模；非法输出 MUST 重试并剥离 code fence，仍失败给出明确错误。

#### Scenario: 结构化评分
- **WHEN** 用户对某技能执行评分
- **THEN** 得到总分/等级与各维度分数及理由并在详情展示

### Requirement: SKILL 优化建议与补丁
系统 SHALL 产出业务与技术两类建议清单及可落盘 patches（完整新文件内容），UI 以 git 风格 diff 呈现前后对比，支持一键应用（经编辑器后端写回）与放弃。

#### Scenario: 应用优化
- **WHEN** 用户查看 SKILL.md 的优化 diff 并点击应用
- **THEN** 文件写回 SSOT、copy 分发重建、操作日志留痕
