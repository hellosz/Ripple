# Tasks: desktop-refinements

## 1. hub 核心

- [x] 1.1 适配器 sharedDirSupport + 固定排序；EffectiveMode 增加 shared；distributeTo/addPlacement(dedicated) 语义与安装记录
- [x] 1.2 SSOT 所有权跟踪（owned），uninstall 仅删 owned；默认存储改 shared
- [x] 1.3 GitLab 私服来源（URL spec 解析 + /-/archive tarball）
- [x] 1.4 操作日志 oplog（500 条上限，全操作埋点）与按 Agent 批量备份 backupAgents
- [x] 1.5 hub 单测：shared placement、owned 保护、gitlab spec/tarball、oplog、批量备份

## 2. 桌面端

- [x] 2.1 shared api/preload/main：addPlacement、backupAgents、oplog/agents 元数据入 snapshot、头图资源
- [x] 2.2 连接卡（头图背景/昵称/防溢出）+ Agent 列表（logo、固定序、空 Agent 折叠）
- [x] 2.3 技能行存在矩阵（通用/专属/未装-补齐），按钮「同步」+「历史」顺序，去除折叠
- [x] 2.4 设置：来源浏览技能弹窗 + GitLab URL 支持、操作记录 tab、按 Agent 多选/全选备份
- [x] 2.5 typecheck/lint/build 全绿，重新打包 Linux
