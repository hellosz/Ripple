# desktop-discovery-view

## ADDED Requirements

### Requirement: 发现视图

桌面 SHALL 在「社区开源」旁提供「发现」视图：仓库排行列表（质量信号标签：stars/活跃/license/来源）、本地搜索过滤、点开仓库懒加载技能清单（含本地评级）；技能可打开只读预览（复用社区只读预览，不允许编辑）。索引降级时 SHALL 显示"配额受限，展示缓存/内置榜单"的提示态。

#### Scenario: 浏览发现榜单

- **WHEN** 用户打开发现视图且索引获取成功
- **THEN** 按 stars 排序展示仓库卡片（含质量标签），点开某仓库看到技能清单与 S/A/B/C 评级

### Requirement: 添加为来源

发现视图中的仓库 SHALL 支持一键「添加为来源」，写入现有 SourceRepo（复用 addSource），成功后该仓库进入既有社区订阅流程（安装/同步/指纹更新检测）；已订阅的仓库 MUST 显示已订阅态而非重复添加。该操作 SHALL 记操作日志。

#### Scenario: 一键订阅

- **WHEN** 用户在发现视图对未订阅的 acme/skills 点击「添加为来源」
- **THEN** sources 中新增该仓库（builtin=false），发现卡片变为已订阅态，操作记录含"添加来源"日志
