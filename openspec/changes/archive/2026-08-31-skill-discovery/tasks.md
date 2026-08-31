# Tasks: skill-discovery

## 1. hub 发现层（packages/hub/src/discover/）
- [x] 1.1 类型与索引缓存：DiscoverRepo/DiscoverIndex、index.json 读写与 TTL、降级链（实时→缓存→种子）+ degraded 标记；单测
- [x] 1.2 数据源：curated 种子清单、topic repo search（fetchImpl 注入可测）、awesome README 解析（失败降级）；限流预算与 403/429 降级单测
- [x] 1.3 仓库懒扫描：tarball 拉取 + scanTarballSkills + rateSkill 评级、按 branch+pushed_at 缓存失效；单测
- [x] 1.4 PAT 深搜（可选能力）：code search filename:SKILL.md、限速退避、未配置时禁用；单测

## 2. 桌面端
- [x] 2.1 IPC：discoverIndex(refresh?)/discoverRepo(owner,repo)/discoverSetPat；PAT safeStorage 存储
- [x] 2.2 发现视图：排行卡片（质量标签）、搜索过滤、降级提示态、懒加载技能清单与 S/A/B/C 展示
- [x] 2.3 只读预览复用 + 一键「添加为来源」（已订阅态、操作日志）
- [x] 2.4 全部门禁（tsc/eslint/vitest/electron-vite build）
