# Proposal: community-sources

## Why
开源仓库（GitHub/私服 GitLab）里的技能没有一级可视入口，也没有"是否更新"的权威判定；本地技能缺来源标识，无法做生命周期管理；更新中心只覆盖技能市场。

## What Changes
- 一级导航新增**「社区开源」**（技能市场之下）：聚合全部绑定仓库的技能（名称/版本/描述/安装态/更新态），可安装与查看。
- **指纹方案**（选定：内容树哈希为主 + 远端提交时间为辅）：技能指纹 = 对目录内全部文件按路径排序的 `sha256(path + sha256(content))` 树哈希（等价 git tree 语义，权威且与传输方式无关）；更新判定 = 远端 tarball 树哈希 ≠ 本地 SSOT 树哈希；更新时间取仓库 API 对该技能子路径的最近 commit 时间（GitHub/GitLab API，best-effort）。
- 本地技能记录**来源标识** origin（registry / repo:<sourceId> / zip / adopt），入库于安装记录并在 UI 展示。
- 更新中心合并两类更新：技能市场（registry 版本比对）+ 社区开源（指纹比对）；对应本地技能行显示"有更新"标记。

## Capabilities
### Modified Capabilities
- `local-skill-hub`: 指纹计算、repo 更新检查、origin 标识、更新时间获取。
- `desktop-client`: 社区开源视图、更新中心合并、本地行更新标记与来源展示。

## Impact
packages/hub、apps/desktop；CLI 自动获益（来源解析共用）。
