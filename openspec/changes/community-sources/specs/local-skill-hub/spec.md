# local-skill-hub（delta）

## ADDED Requirements

### Requirement: 技能指纹
hub SHALL 以内容树哈希作为技能指纹：对目录内全部文件按路径排序拼接 `path + "\n" + sha256(content)` 后整体 sha256（与传输方式无关、跨端一致）。指纹 MUST 可对 SSOT 目录与 tarball 内技能分别计算。

#### Scenario: 内容不变指纹稳定
- **WHEN** 同一技能经 tarball 与本地目录分别计算指纹
- **THEN** 两者一致；任一文件变更后指纹变化

### Requirement: 安装来源标识
每条安装记录 MUST 携带 origin（registry / repo:<sourceId> / zip / adopt），在所有安装路径落点，供生命周期管理与 UI 展示。

#### Scenario: 来源可追溯
- **WHEN** 从社区仓库安装技能
- **THEN** 记录 origin=repo:<sourceId>

### Requirement: 社区更新检查
hub SHALL 提供 checkCommunityUpdates：逐来源拉取 tarball，对与本地同名的技能比对指纹，产出 {skill, sourceId, changed, localFingerprint, remoteFingerprint, remoteUpdatedAt}；remoteUpdatedAt 经 GitHub/GitLab commits API（按技能子路径过滤）best-effort 获取，失败为 null 不阻塞。

#### Scenario: 指纹差异判定更新
- **WHEN** 远端仓库中某技能文件有改动
- **THEN** checkCommunityUpdates 标记 changed=true 并给出两侧指纹
