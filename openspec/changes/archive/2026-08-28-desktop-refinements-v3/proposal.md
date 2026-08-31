# Proposal: desktop-refinements-v3

## Why
第三轮真机验证反馈：placement 标识用"专"字不直观且未同时呈现通用/专属双态、社区开源不能折叠与预览、URL 添加的 GitHub 仓库 label 异常、Skill 预览不渲染 Markdown 且无素材预览、AI 缺使用日志与费用视图、桌面无卸载入口；另需按最新调研修正各 Agent 的共享目录支持度，并新增 AI 应用场景分析。

## What Changes
- **Agent 规范修正**：按逐 Agent 调研结论更新 `sharedDirSupport`（证据不足者保守 false）。
- **placement 双态标识**：去掉「专」字——通用（经 `~/.agents/skills`）与专属（agent 私有目录）用记号/背景色区分并可**同时显示**；仍支持按 Agent 单独配置 dedicated。
- **社区开源**：按仓库折叠；技能行点击打开**只读预览**（不允许编辑）。
- **来源 label 修正**：`github.com` URL 形式添加的仓库不再带 host 前缀、不误标 GitLab。
- **Skill 查看器**：预览模式 Markdown 渲染样式，编辑模式显示原文；新增**通用本地素材预览**（图片等二进制资源可预览而非跳过）。
- **AI 应用场景分析**：基于 skill 内容生成 业务/岗位/场景/工具 标签与概要，**持久化本地**（内容指纹变化可重新分析），本地技能与详情展示标签。
- **AI 使用日志与费用**：记录每次 AI 调用（时间/功能/模型/输入输出 tokens/估算费用），设置-AI 服务商 tab 展示日志与累计费用（内置 openai/deepseek 单价表，custom 仅记 tokens）。
- **卸载入口**：桌面支持两种维度——整技能卸载（全部安装位置）与指定 Agent 下卸载（单 placement），均带确认与自动备份提示。
- 设置行小字说明（来源 · 备份 · 记录）去掉。

## Capabilities
### Modified Capabilities
- `local-skill-hub`: sharedDirSupport 修正、场景分析结果持久化、素材文件读取（二进制 base64）。
- `desktop-client`: 上述 UI 全部。
- `skill-ai-review`: 场景分析契约、使用日志与费用。

## Impact
packages/hub、packages/skill-core、packages/contract、apps/desktop。
