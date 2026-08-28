# Tasks: desktop-refinements-v3

## 1. 核心层
- [x] 1.1 调研落地：sharedDirSupport 按证据修正（含注释依据）
- [x] 1.2 hub：场景分析持久化（state.scenarios + 指纹）、readSkillAsset（base64+mime，5MB 上限，防穿越）；单测
- [x] 1.3 来源修正：github.com URL 不存 host；单测
- [x] 1.4 AI：场景分析 prompt/契约（skill-core+contract）、用量日志与费用（单价表、200 条持久化）；单测
- [x] 1.5 desktop shared api/main/preload：aiScenario、readSkillAsset、aiUsage、卸载入口复用现有 uninstall

## 2. renderer
- [x] 2.1 placement 双态标识（记号/背景色，去「专」字，双态并存，悬浮说明）
- [x] 2.2 社区开源按仓库折叠 + 只读预览弹窗；来源 label 修正；设置行小字去掉
- [x] 2.3 查看器：Markdown 渲染预览/原文编辑切换、图片素材内联预览
- [x] 2.4 场景分析：技能详情「场景」入口 + 标签与概要展示 + 指纹过期提示；本地行标签摘要
- [x] 2.5 AI tab：使用日志（时间/功能/模型/tokens/费用）与累计费用
- [x] 2.6 卸载：技能行/详情菜单（整技能 / 按 Agent），确认+备份提示
- [x] 2.7 全绿并重打 Linux 包
