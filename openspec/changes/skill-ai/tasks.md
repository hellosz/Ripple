# Tasks: skill-ai

## 1. 主进程
- [x] 1.1 AI 服务商配置存储（safeStorage）与 OpenAI 兼容调用封装（超时/重试/JSON 兜底）
- [x] 1.2 评分：rubric prompt（按调研报告）+ 结构化解析；优化：建议+patches prompt
- [x] 1.3 shared api / preload：aiConfig get/set、aiScore、aiOptimize

## 2. renderer
- [x] 2.1 设置「AI 服务商」tab（openai/deepseek/custom 表单、连接测试）
- [x] 2.2 详情内评分卡（总分/等级/维度条+理由）
- [x] 2.3 「优化」按钮 → 建议清单 + git 风格 diff（前后对比）→ 一键应用/放弃
- [x] 2.4 全绿并打包
