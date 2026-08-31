# Audit: skill-discovery

## Before This Change

- 社区开源只能浏览用户手动订阅的仓库，没有任何"发现新技能"的入口；用户需自行去 GitHub 搜索。
- 无质量信号展示，无法在安装前评估仓库/技能水准。

## Gaps Identified

- GitHub 免鉴权 60 次/小时为全局硬顶（同 IP 共享）→ 单次刷新预算 ≤8 请求 + 降级链（实时→缓存→种子）+ degraded 贯穿 UI。
- 远端（未订阅）技能无文件读取通道 → 只读预览为元信息级，与社区未安装技能预览语义一致；全文浏览引导先订阅。
- awesome 列表 markdown 格式无稳定性 → 解析失败静默降级为仅官方种子。

## Implemented Contract

- **hub `discover/`**：DiscoverRepo/DiscoverIndex 类型；`getIndex(refresh?)` 24h TTL 索引（curated 种子 anthropics/skills + awesome 列表解析 + `topic:agent-skills` repo search 按 stars 排序，质量信号 stars/pushed_at/license/topics/origin）；限流降级链与 degraded 标记；`getRepoSkills` codeload tarball 懒扫描 + rateSkill S/A/B/C 本地评级（branch+pushed_at 缓存键）；`deepSearch(pat)` code search 深搜（429 退避一次，PAT 不落盘不进日志）。10 个单测。
- **desktop**：IPC discoverIndex/discoverRepo/discoverSetPat/discoverPatStatus/discoverDeepSearch；PAT safeStorage 加密存于 userData；「发现」一级视图（排行卡片、活跃/来源/license 标签、本地过滤、degraded 提示、懒加载技能清单与评级、只读元信息预览、一键「添加为来源」接入既有 addSource/订阅通道并记操作日志、PAT 深搜合并展示）。
- 测试与门禁：hub 74 测全绿（含 discover 10）、全仓 151 测、tsc/eslint/electron-vite build 通过。
