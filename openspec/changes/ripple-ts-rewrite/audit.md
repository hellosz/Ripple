# Audit: ripple-ts-rewrite

## Before This Change

- **技术栈**：FastAPI + SQLAlchemy(async) + Alembic（Python 3.12）后端；Next.js 15 旧版前端（视觉为旧设计）；零依赖 Node CLI（`@ripple/cli` 0.2.x，依赖系统 `zip`/`unzip`，分发走 `backend/static/cli/ripple-cli.tgz` 自托管）。
- **形态**：仅 Web + 简易 CLI。无桌面客户端；无本地技能管理（无 SSOT/多 Agent 分发/备份回退/GitHub 来源）；无热度体系（仅 copy/like/download/ripple 计数与 size_tier）；无合辑、关注、浏览计数。
- **基础设施**：git 远端在内部 GitLab（`gitlab.interfocus.tech:fabulous/ripple`）；无 CI；前端 API base 硬编码 `localhost:8000` rewrite。
- **已知缺口**：`tags` 过滤解析后未使用；列表 N+1 查询；`PUT /skills/{slug}` slug 与包内 name 不一致行为不明；CLI 三处版本号不一致；后端仅 9 个纯函数单测、e2e 仅 5 个视觉断言。

## Gaps Identified

实施中发现并处理的新缺口：

1. **存量库 DB 级默认值缺失**（SQLAlchemy 把 id/role/status/rating 等默认放在 Python 侧）：新栈依赖 DB default 的插入在存量库上失败 → 新增 `0003_legacy_defaults_parity.sql`（补默认值 + 回填 + NOT NULL，对全新库幂等）。
2. **本地开发库停在 Alembic 0003**：接管流程实测为 旧栈升 head → `db:stamp-baseline` → `db:upgrade`，已写入 docs/database-workflow.md。
3. **npm 包名 `ripple` 被占用**（trueadm 的 Ripple 框架，活跃发版；`ripple-cli` 亦被占）→ 经确认改用 scope 包 **`@hellosz/ripple`**，bin 仍为 `ripple`。
4. **共享机器端口冲突**：宿主 5432/8000 被其他项目占用 → compose override 将 PostgreSQL 映射 5433、dev server 用 8010（.env 可配）。
5. **tsup 单文件 ESM 打包**：CJS 依赖动态 require 内置模块 → banner 注入 `createRequire` 垫片。

## Implemented Contract

7 个能力 spec 全部落地，68/68 任务完成；验证基线（本地全绿）：

- `pnpm lint` / `pnpm typecheck`（9 包）
- `pnpm test`：**120 个用例**（contract 6 heat 公式、skill-core 32 校验/评级表驱动与 Python 行为对齐、api-client 10、hub 22 本地管理语义、server **32 个真库集成测试**、CLI 11 子进程集成、web 13 组件）
- `npx playwright test`：**14 个业务流 e2e**（首页/搜索/详情/登录→copy→like→ripple 前置链/评论/合辑/文档站），配置自动编排 server+web 双 webServer 与幂等种子
- 构建：web（15 路由）、desktop（electron-vite 三段）、cli（单文件 605KB，`--version` 与包版本单一来源）
- CLI 真环境闭环实测：publish（评级+建议）→ install（symlink）→ list --installed → agent list → uninstall（自动备份）→ backup list

关键契约：

- **server-api**：Fastify + Drizzle 全域路由（认证/设备码/技能/互动/热度/RP 推送/SSE/评论/合辑/关注/管理后台）；错误体统一 `{error:{code,message}}`（client 兼容旧 `detail`）；灰度门控；列表聚合单查询修复 N+1；tags 过滤生效；热度 `传播×1+收藏×2+评论×4+查询×0.05` 周归一化（分母下限防小流量放大）；浏览按 user/guest×日去重。
- **数据库接管**：baseline 与 Alembic head 等价、存量库只 stamp；新增 skill_views/collections/collection_skills/user_follows；删除 git_path/git_commit_sha（含 down）；自研迁移器（`ripple_migrations` 记账，支持 stamp/downgrade）。
- **skill-package-spec**：skill-core 三端共享（frontmatter 契约、ZIP 穿越防护、10MB 上限、S/A/B/C 评级与建议——移植测试锁定与 Python 一致）。
- **local-skill-hub**：SSOT（内置/共享可迁移）、state.json 原子写、symlink/junction/copy 三级降级、8 个 Agent 适配器注册表、项目作用域、扫描（unmanaged/missing/冲突）、同步收敛、备份 20 份 FIFO + 任意版本回退、GitHub tarball（自实现 tar 解析）/ZIP 离线来源。
- **web-community**：原型 1:1（水波 Hero 物理模拟移植、四 tab 信息流、⌘K 浮层、详情页全件套、预览热度分解、合辑、个人中心 AI 画像、文档站四篇、SSE 通知+揭示弹窗、Deep Link 回退复制、admin 后台）。
- **desktop-client**：Electron 主进程承载 hub + 类型化 RPC、`ripple://` 三平台协议注册与单实例、electron-updater（GitHub provider）、safeStorage token、renderer 全视图（侧边栏/本地列表/市场/更新中心/设置/同步/历史/登录/门控/状态栏）、CI 无头冒烟（RIPPLE_SMOKE）+ 三平台人工清单。
- **cli-tool**：`@hellosz/ripple`（bin `ripple`）、名词+动词分组 + 旧别名兼容、`--json`/退出码 0/1/2/非 TTY 降级/`--yes`、配置四级分层（含来源显示）、设备码登录、离线 `--zip`/`--from` 安装、迁移对照 README。
- **distribution**：GitHub 迁移（SHA 一致、默认分支 main、gitlab 只读保留）；CI（lint/typecheck/unit/build + e2e 带 postgres/redis/minio 服务 + desktop-smoke）；`cli-v*`/`desktop-v*` tag 发布流水线（npm / GitHub Release + updater 元数据）；changesets；旧 tgz 分发随旧栈退役，`/api/cli/version` 指向 npm。

## 未尽事项（归档后跟进）

- 生产环境切换窗口与旧服务下线的运维执行（代码/迁移/文档已就绪；本仓库不含生产部署编排）。
- 首次 npm 发布需配置 `NPM_TOKEN` secret 并确认 `@hellosz` scope 归属；桌面安装包暂无代码签名（设计已声明接受）。
- 桌面三平台人工冒烟清单（docs/desktop-smoke-checklist.md）在首个 Release 后执行。
