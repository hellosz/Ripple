# Proposal: skill-discovery

## Why

现有「社区开源」只能浏览用户已手动订阅的仓库，发现新技能完全靠用户自己在 GitHub 上搜。生态调研（2026-08-31）表明开源技能生态已成规模（`topic:agent-skills` ≈ 1.87 万仓库、官方 anthropics/skills、多个万星级 awesome 列表），但缺少一个"发现 → 评估质量 → 一键订阅"的入口。

## What Changes

- hub 新增发现层：内置 curated 种子（官方库 + awesome 列表解析）+ GitHub `topic:agent-skills` repo search 排行（stars/近 90 天活跃/license 质量信号），索引缓存 24h TTL（`~/.ripple/discover/`），免鉴权配额受限时降级为缓存/种子。
- 仓库详情按需经 codeload tarball 懒扫描（不计 API 配额），复用 `scanTarballSkills`；技能质量双轨：远端信号 + 本地 `rateSkill` S/A/B/C 评级。
- 桌面新增「发现」视图：排行/搜索/质量标签、技能只读预览、一键「添加为来源」写入现有 SourceRepo 进入既有安装/同步通道。发现=只读探索层，订阅=管理层，不引入第二套安装逻辑。
- 可选：用户配置 GitHub PAT 后启用 code search `filename:SKILL.md` 深度探索（10 次/分钟限速）。

## Capabilities

- `skill-discovery`：hub 层索引获取/缓存/awesome 解析/质量信号/懒扫描（纯 Node 可测）。
- `desktop-discovery-view`：发现视图、只读预览、添加为来源、本地评级展示、配额降级态。

## Impact

- 新增 `packages/hub/src/discover/`；桌面新增视图与 IPC。
- 外部依赖：GitHub REST（免鉴权 60 次/小时硬顶，需降级 UI）与 codeload tarball（无配额）；awesome 列表解析失败静默降级。
- 第三方技能内容仅在用户主动安装时落盘且必过 skill-core 校验（沿用既有约束）。
