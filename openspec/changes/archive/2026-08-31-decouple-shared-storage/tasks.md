# Tasks: decouple-shared-storage

## 1. hub
- [x] 1.1 sharedDir 常量与 skillDir 解析（SSOT 优先/共享回退）；listSkillNames 双根枚举
- [x] 1.2 distributeTo 共享落点判定改为"技能实际在共享目录"；内置 SSOT 共享 → 建 symlink（冲突明示）；removeDistribution 删除仅限指向我方 SSOT 的链接
- [x] 1.3 单测：内置模式识别共享目录技能、共享 symlink 建立/移除安全、同名冲突、通用模式行为不变

## 2. desktop
- [x] 2.1 snapshot 双根枚举 + skills[].shared 标记；shared api 类型
- [x] 2.2 renderer：「共享」按钮隐藏条件改用 shared 标记；设置存储位置文案说明解耦语义
- [x] 2.3 门禁全绿 + 重打 Linux 包
