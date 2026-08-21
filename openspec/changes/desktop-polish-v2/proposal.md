# Proposal: desktop-polish-v2

## Why
第二轮真机验证反馈：连接卡布局与登录态表达仍不对、四个 Agent logo 有误、项目视图不分组且删除关联后残留、技能行信息密度与操作动线待优化、本地技能缺少详情查看与编辑能力、市场卡片安装态表达异常。

## What Changes
- 连接卡：去掉"已登录"字样（面板风格即登录态）；未登录只显示 Logo+Ripple 且背景置灰；修正 Logo 区上方留白与错位。
- Agent logo 修正（Codex/Hermes/Pi/OpenClaw 按官方资产调研结果替换）。
- 「仅项目」视图：按项目**分组折叠**展示全部关联项目；移除项目关联时同步清理其作用域安装记录（文件保留）。
- 本地技能列表头：横排 Agent 图标（悬浮显示名称），支持**把当前范围全部技能批量复制/取消复制到该 Agent**（二次确认）。
- 技能行 v3：更疏松；去技能字母图标；版本小字置于「同步」按钮下方；点击行打开**本地 Skill 详情**——文件树 + 内容（VSCode 风格：行号/等宽/语法高亮基调），支持**手动编辑并保存**（保存回 SSOT 并重建 copy 分发）。
- 技能市场卡片：不再显示"已安装"文字，用卡片底部 100% 进度条（安装态色）标识；有更新待同步用另一色进度条与同步按钮变色；点击卡片查看 Skill 主要信息（对齐 Web 详情非文件部分），文件部分对齐本地详情风格。

## Capabilities
### Modified Capabilities
- `desktop-client`: 上述 UI/交互全部。
- `local-skill-hub`: removeProject 清理作用域记录；批量 Agent placement/移除；SSOT 技能文件读写（编辑器后端）。

## Impact
packages/hub、apps/desktop（shared/main/renderer）。
