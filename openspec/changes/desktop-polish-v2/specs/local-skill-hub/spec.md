# local-skill-hub（delta）

## ADDED Requirements

### Requirement: 项目关联清理
removeProject MUST 同步移除该项目作用域的全部安装记录（不触碰磁盘文件），并写入操作日志。

#### Scenario: 记录随关联移除
- **WHEN** 移除含 30 个作用域安装的项目
- **THEN** installs 中该 scope 记录清零，项目目录文件保留

### Requirement: 按 Agent 批量 placement
hub SHALL 提供 applyAllToAgent（把指定技能集合补齐到某 Agent）与 removeAllFromAgent（移除某 Agent 全部全局 placement）；两者 MUST 免逐技能备份（内容不变）、以单条操作日志汇总，且 removeAllFromAgent 不删除 SSOT 内容。

#### Scenario: 批量取消复制
- **WHEN** 对 Hermes 执行 removeAllFromAgent
- **THEN** Hermes 的全局安装记录与专属分发全部移除，SSOT 与其他 Agent 不受影响

### Requirement: SSOT 技能文件读写
hub SHALL 提供 readSkillFiles（文本文件清单与内容，跳过二进制与超限文件）与 writeSkillFile（写回 SSOT、重建该技能全部 copy/junction 型分发、记录操作日志）。写入 MUST 拒绝路径穿越。

#### Scenario: 保存后 copy 分发同步
- **WHEN** 某技能存在 copy 模式分发且用户保存修改
- **THEN** 分发目录内容随之更新
