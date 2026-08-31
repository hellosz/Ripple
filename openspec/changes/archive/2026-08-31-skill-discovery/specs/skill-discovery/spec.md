# skill-discovery

## ADDED Requirements

### Requirement: 发现索引获取与缓存

hub SHALL 聚合两类来源构建发现索引：内置 curated 种子仓库清单（官方 anthropics/skills 及精选 awesome 列表解析出的仓库）与 GitHub repo search（`topic:agent-skills`，按 stars 与最近推送排序）；索引 SHALL 缓存于 `~/.ripple/discover/index.json`（TTL 24 小时），过期或手动刷新时重新获取。单次刷新 MUST 控制在 8 个 API 请求以内；请求失败或触发限流 MUST 回退到上次缓存（无缓存则仅种子），并向调用方返回降级标记。

#### Scenario: 限流降级

- **WHEN** GitHub 返回 403/429 且本地存在昨日索引缓存
- **THEN** 返回缓存索引并标记 degraded=true，不抛错

### Requirement: 质量信号

发现索引中的仓库条目 SHALL 携带质量信号：stars、最近推送时间（近 90 天活跃标记）、license 有无、topics、来源（curated/topic-search）；awesome 列表解析失败时 SHALL 静默降级为仅官方种子。

#### Scenario: 活跃度标记

- **WHEN** 某仓库 pushed_at 距今 30 天且 stars=2400
- **THEN** 索引条目含 stars=2400、近 90 天活跃=true

### Requirement: 仓库技能懒扫描与本地评级

仓库内技能清单 SHALL 在用户查看该仓库时才经 codeload tarball 拉取并用 scanTarballSkills 解析，结果按仓库缓存（`discover/<owner>__<repo>.json`，以 branch+pushed_at 判断失效）；每个技能 SHALL 附本地 rateSkill 评级（S/A/B/C）。tarball 拉取失败 MUST 返回明确错误且不影响索引浏览。

#### Scenario: 懒扫描并缓存

- **WHEN** 用户首次点开发现列表中的仓库 acme/skills
- **THEN** 拉取 tarball 扫描出技能清单（含各自 S/A/B/C 评级）并写入缓存；再次点开且仓库无新推送时直接读缓存

### Requirement: PAT 深度探索（可选）

用户配置 GitHub PAT 后，hub SHALL 支持 code search `filename:SKILL.md` 补充发现（遵守 10 次/分钟限速，超限退避）；未配置 PAT 时该能力不可用且不影响基础发现。PAT SHALL 加密存储（桌面 safeStorage），MUST NOT 写入任何日志。

#### Scenario: 未配置 PAT

- **WHEN** 用户未配置 PAT 并使用发现功能
- **THEN** 基础索引（种子+topic 搜索）正常工作，深度探索入口提示需配置 PAT
