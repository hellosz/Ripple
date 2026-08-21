# Tasks: desktop-polish-v2

## 1. hub 与 IPC
- [ ] 1.1 removeProject 清理该作用域安装记录（文件保留）+ oplog；单测
- [ ] 1.2 批量操作：applyAllToAgent / removeAllFromAgent（免逐技能备份、单条 oplog）；单测
- [ ] 1.3 编辑器后端：readSkillFiles / writeSkillFile（SSOT 读写 + copy 分发重建 + oplog）；单测
- [ ] 1.4 desktop shared api / main / preload 暴露以上能力

## 2. renderer
- [ ] 2.1 连接卡登录态重构 + Logo 布局修正 + 未登录置灰
- [ ] 2.2 Agent logo 按调研结果替换（agent-icons.tsx）
- [ ] 2.3 仅项目视图按项目分组折叠
- [ ] 2.4 列表头 Agent 批量复制/取消复制（确认弹窗）
- [ ] 2.5 技能行 v3 布局 + 本地 Skill 详情（文件树/内容/编辑保存）
- [ ] 2.6 市场卡片安装态进度条 + 市场 Skill 详情弹窗
- [ ] 2.7 全绿（tsc/lint/build）并打包
