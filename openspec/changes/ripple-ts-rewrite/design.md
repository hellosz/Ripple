# Design: ripple-ts-rewrite

## Context

Ripple 现状：FastAPI + SQLAlchemy(async) + PostgreSQL + Redis + MinIO 的 Python 后端，Next.js 15 前端，零依赖 Node CLI。功能已覆盖认证（JWT + OAuth 设备码）、技能上传校验与 S/A/B/C 规则评级、MinIO 对象存储 + `skill_files` 全文搜索（pg_trgm）、copy/like/download/ripple 互动、RP 随机推送 + 游客会话认领、SSE 通知（Redis pub/sub）、嵌套评论、管理后台、灰度发布。git 远端在内部 GitLab。

目标形态由两份设计原型定义（Claude Design「内容社区主题重构方案」）：

- 《Ripple 首页 · 交互原型》：Web 社区——橄榄绿视觉体系、Hero 水波 canvas、推荐/最热/最新/关注信息流、热度体系（传播×1+收藏×2+评论×4+查询×0.05，周归一化）、热度榜、分类、⌘K 搜索浮层、预览弹窗（热度分解）、详情页（安装条/ZIP/统计条/markdown 章节/文件树预览/评论/TOC/版本历史）、合辑、个人中心、文档站（概览/CLI/桌面客户端/Skill 规范）。
- 《Ripple 桌面客户端 · 原型》：1280×820 桌面应用——侧边栏（连接状态、本地技能/技能市场/更新中心、Agent 全局列表、项目目录、重新扫描、设置）、本地技能列表（范围筛选、版本不一致横幅、安装矩阵 chips、展开逐处管理：更新/启用禁用/卸载）、同步弹窗（勾选 Agent×项目目标）、历史弹窗（时间线+回退）、技能市场（浏览/排行榜/合集）、更新中心（全部更新）、设置（中心存储/分发方式/GitHub 仓库源/ZIP/Deep Link、备份管理）、登录/本地模式门控、状态栏。

约束：桌面客户端必须支持 Linux/macOS/Windows 且使用通用前端栈（与 Web 共享）；CLI 能力≈桌面客户端、命令设计遵循 lark-cli 式规范；迁移到 GitHub，CLI 走 npm registry、桌面走 GitHub Release 分发。

## Goals / Non-Goals

**Goals:**
- 全栈统一 TypeScript：一个 pnpm monorepo 产出 server、web、desktop、cli 四个应用与共享包。
- API 能力对现有后端做行为等价重写（含修复已知缺口），并扩展热度、合辑、关注流、浏览计数。
- 桌面客户端与 CLI 共享同一个本地技能管理核心库（SSOT、适配器、备份、来源），Web 端仅做服务侧。
- 保留 PostgreSQL 数据与 schema（平滑接管，不重灌数据）；Redis、MinIO 沿用。
- 仓库迁移 GitHub + GitHub Actions CI + npm/GitHub Release 分发管线。

**Non-Goals:**
- 不做移动端；不做 Web 端的本地技能管理（浏览器无文件系统权限，Web 通过 Deep Link 唤起桌面客户端）。
- 不改变认证模型（仍是 email 注册 + JWT + 设备码；不引入 OAuth 三方登录）。
- 不做多语言 i18n（跟随原型，中文为主）。
- 不在本变更内做技能付费、组织/团队空间等新业务。
- 原型中的示例数据（技能、作者、评论）不作为实现内容。

## Decisions

### D1 Monorepo 布局（pnpm workspace）

```
ripple/
├── apps/
│   ├── server/      # Fastify API 服务
│   ├── web/         # Next.js Web 社区
│   ├── desktop/     # Electron 桌面客户端
│   └── cli/         # ripple CLI（npm: ripple-cli）
├── packages/
│   ├── contract/    # zod schema + API 类型契约（三端共享）
│   ├── api-client/  # 基于 contract 的类型安全 HTTP/SSE client（web/desktop/cli 共享）
│   ├── skill-core/  # SKILL.md 解析/校验/评级（server 与本地端共享）
│   ├── hub/         # 本地技能管理核心（desktop/cli 共享，Node-only）
│   └── ui/          # 共享 React 组件与设计 token（web/desktop 共享）
├── e2e/             # Playwright
└── .github/workflows/
```

现有 `backend/`（Python）与 `cli/`（旧版）在切换完成后删除。理由：能力清单显示三端有大量重叠逻辑（API 契约、SKILL.md 处理、本地安装），monorepo + 共享包是唯一避免三份实现漂移的结构。

### D2 服务端：Fastify + Drizzle ORM（而非 NestJS/Prisma）

- **Fastify**：与 FastAPI 心智接近（schema 校验、插件化），原生支持 multipart 上传与 SSE（`reply.raw` 流），性能好、生态成熟。NestJS 被否：对本项目规模引入过多抽象层。Hono 被否：Node 生态下 multipart/SSE/插件成熟度不如 Fastify。
- **Drizzle ORM + drizzle-kit**：SQL-first，TS 里声明 schema，正好用于"接管既有 PostgreSQL schema"——用 `drizzle-kit pull` 内省现库生成 baseline，后续迁移线性追加。Prisma 被否：接管既有库与 pg_trgm/GIN 等自定义索引的表达不如 Drizzle 直接。
- 校验层用 zod，schema 定义放 `packages/contract`，server 用 `fastify-type-provider-zod` 接入，同一份 schema 生成 OpenAPI 文档。
- 认证沿用 HS256 JWT（`jose`），依赖注入三档（必须登录/可选/admin）以 Fastify decorator + preHandler 实现；设备码流程状态继续存 Redis（同样的 key 结构与 TTL）。
- SSE 沿用现设计：进程内 user_id→连接集合，Redis `ripple:sse:{user_id}` pub/sub 跨实例，30s 心跳，连接时补发 pending 推送。
- 对象存储用 `@aws-sdk/client-s3` 对接 MinIO（key 结构不变：`{name}/{version}/{sha256}.zip`）。
- 邮件 `nodemailer`；LLM 画像生成用 OpenAI SDK（保留降级到静态模板）。

### D3 数据库：schema 平滑接管 + 热度扩展

- baseline 迁移 = 现有 Alembic head（`20260316_0005`）的等价 schema；部署时对已有库仅做"标记已应用"。
- 新增：`skill_views`（查询计数，按 user/guest/日去重）、`collections` + `collection_skills`（合辑）、`user_follows`（关注作者，支撑"关注"tab）。
- 清理遗留：`skills.git_path`、`skill_versions.git_commit_sha` 删除（独立迁移，可回滚）。
- 热度：不落列，读时计算 + Redis 缓存。`heat_raw = ripples×1 + likes×2 + comments×4 + views×0.05`；周归一化 `heat = round(100 × heat_raw / max_heat_raw_7d)`，`max_heat_raw_7d` 每小时刷新缓存。语义映射：传播=ripple、收藏=like、评论=comments、查询=views。列表接口一次性 JOIN 聚合，修复现有 N+1。

### D4 桌面客户端：Electron（而非 Tauri）

- **Electron + electron-vite + React**：主进程承载 `packages/hub`（文件系统、symlink、扫描、备份），渲染进程复用 `packages/ui` 组件与 `packages/api-client`；typed IPC（`electron-trpc` 风格的手写 contract）。
- Tauri 被否：核心逻辑要求与 CLI 共享（Node 库 `hub`），Tauri 主进程是 Rust，会造成本地管理逻辑双实现，违背"通用前端技术栈 + TS 全栈"前提。Electron 三平台打包（electron-builder）与自动更新（electron-updater 的 GitHub Release provider）开箱即用。
- Deep Link：electron-builder 注册 `ripple://` 协议（`install?skill=<slug>&version=<v>` 唤起安装流程；macOS `open-url`、Win/Linux second-instance 参数解析）。
- 窗口视觉按原型：1280×820 默认尺寸，橄榄绿主题，侧边栏布局。

### D5 本地技能管理核心（packages/hub）

- **SSOT 目录**：默认 `~/.ripple/skills/<name>/`（每技能一个目录，内含版本内容）；可切换共享目录 `~/.agents/skills`；切换时平滑迁移（复制→重建链接→删旧），状态不丢。
- **状态文件** `~/.ripple/state.json`：installs（skill × agent × scope[global|项目] × version × enabled）、项目目录列表、来源仓库、设置（存储位置/分发方式）。所有写操作原子（临时文件+rename）。
- **分发**：默认 symlink（Windows 优先 junction，失败降级 copy 并记录），可全局切换为 copy 模式。禁用 = 移除目标目录链接但保留 SSOT 与状态；启用 = 重建链接。
- **Agent 适配器**：声明式注册表 `{ id, name, globalPath, projectRelPath, detect() }`，内置 Claude Code(`~/.claude/skills`)、Codex(`~/.codex/skills`)、OpenCode(`~/.opencode/skill`)、Cursor(`~/.cursor/skills`) 等，未检测到的显示但置灰；新增 Agent 仅需添加适配器条目。
- **扫描**：启动/手动扫描 Agent 目录与项目目录，识别非 hub 管理的已有技能（导入为 unmanaged 记录），检测版本不一致。
- **备份**：更新/同步/卸载前把 SSOT 中该技能当前版本打 zip 快照到 `~/.ripple/backups/<name>/<ts>-<version>.zip`，全局保留最近 20 份（FIFO 清理）；恢复 = 解包回 SSOT + 重建链接 + 写历史。历史记录（安装/更新/同步/回退时间线）随 state.json 保存。
- **来源**：① Ripple 服务（registry API + ZIP 下载）；② GitHub 仓库（owner/repo/branch/subdir，走 codeload tarball，无需 git 二进制；扫描含 SKILL.md 的目录）；③ 本地 ZIP。②③在未登录本地模式可用。ZIP 解压用纯 JS（`yauzl`/`fflate`），移除对系统 `zip/unzip` 的依赖；解压均带路径穿越防护（复用 skill-core 校验）。

### D6 CLI：commander + 分组命令（lark-cli 式规范）

npm 包名 `ripple`，bin `ripple`，Node ≥ 20，tsup 打成单文件。命令面（对齐桌面能力）：

```
ripple login [--remote] / logout / whoami          # 设备码认证
ripple search <q> / info <name> / install <name> [--agent <id>] [--project <dir>]
ripple update [<name>|--all] / uninstall <name>
ripple publish <path> [--channel gray] / list [--installed]
ripple agent list|scan                             # Agent 检测与安装矩阵
ripple sync <name> [--to <agent>...]               # 同步到多目标
ripple enable|disable <name> --agent <id>
ripple source list|add <owner/repo>[#branch][:subdir]|remove
ripple backup list|restore <id>|prune
ripple config get|set <key> [value]
ripple self-update
```

规范（参考 lark-cli）：名词+动词分组；全局 `--json` 输出稳定机器可读结构；`--server/--token` + 环境变量（`RIPPLE_SERVER/RIPPLE_TOKEN`）+ `~/.ripplerc` 三级配置；非 TTY 自动禁用交互与彩色；退出码 0 成功 / 1 业务失败 / 2 参数错误；破坏性操作需 `--yes` 才免确认。顶层动词（install/search/publish…）保留为常用捷径，与旧 CLI 迁移对照写入 README。

### D7 Web：Next.js 15 保留，按原型重构

- 保留 Next.js App Router + Tailwind v4；页面结构：`/`（信息流+Hero 水波 canvas）、`/skill/[slug]`、`/collections`、`/docs/*`（概览/CLI/桌面/Skill 规范）、`/me`、`/admin/*`、`/auth/device`。
- 设计 token（橄榄绿色板、Noto Sans SC + Space Grotesk、圆角/阴影体系）沉淀到 `packages/ui`，desktop 复用。
- API base 改为环境变量（修复 rewrite 硬编码 localhost:8000 的部署缺口）；SSE/认证/游客 session 逻辑迁入 `packages/api-client`。
- 详情页"安装"按钮：优先尝试 `ripple://install?...` Deep Link 唤起桌面客户端，回退复制 CLI 命令。

### D8 GitHub 迁移与分发

- 迁移：GitHub 新建仓库 `Ripple`（保留全部历史：`git push --mirror`），origin 切换；GitLab 远端保留只读过渡期。
- 版本与发布：changesets 管版本；`v*` tag 触发 GitHub Actions——`release-cli.yml` 构建并 `npm publish`（包名 `ripple`，NPM_TOKEN secret）；`release-desktop.yml` 三平台矩阵 electron-builder 构建（AppImage+deb / dmg / nsis exe）上传 GitHub Release，electron-updater 据此自动更新。
- CI：PR 触发 lint + typecheck + vitest + web build + Playwright（关键流程）。
- 旧 `backend/static/cli/ripple-cli.tgz` 自托管分发废弃，`/api/cli/version` 改为返回 npm dist-tag 信息供 `self-update` 提示。

## Risks / Trade-offs

- [行为等价风险：Python→TS 重写遗漏隐式行为（游客认领、RP 随机抽样规则、评级细节）] → 以 `enhance-skill-engagement-and-comments`、`migrate-skill-storage-to-minio` 两个 change 的 spec 为契约基准；评级/校验规则在 `skill-core` 里用现有 Python 测试用例的移植版做表驱动测试。
- [Windows symlink 权限（非管理员/未开发者模式不可建 symlink）] → 目录用 junction（无需特权），失败自动降级 copy 并在 UI/CLI 明示当前分发方式。
- [Electron 包体积大、内存高] → 接受（换取 TS 单栈与共享 hub 库）；发布物用 asar + 平台裁剪控制体积。
- [npm 包名 `ripple` 若在 registry 端发布受阻（占用/相似名拦截）] → 发布前用 `npm view ripple` 验证并尽早占位发布 0.0.x 占位版本。
- [热度周归一化导致小流量期热度剧烈波动] → 归一化分母取 `max(周最大热度, 下限常数)`，避免除小数放大。
- [DB 接管：drizzle baseline 与 Alembic 现状偏差] → 上线前用 schema diff 工具核对 information_schema；baseline 迁移在既有库上只 stamp 不执行。
- [双栈并行期（Python 旧服务 vs TS 新服务）数据写冲突] → 不并行写：按环境整体切换，API 兼容层保证前端/CLI 可指向任一后端过渡。
- [SSE 在 Fastify 的连接管理（超时/背压）] → 复用现有心跳协议；连接数指标暴露到 /api/health。

## Migration Plan

1. **仓库先行**：GitHub 建仓 `Ripple` → `git push --mirror` → 切 origin；monorepo 骨架落地（旧 `backend/`、`frontend/`、`cli/` 原地保留直至各端切换完成）。
2. **共享包**：contract / skill-core / api-client 先行（评级与校验用移植测试锁行为）。
3. **server**：按 spec 重写，集成测试对照现有 API 行为；DB baseline stamp；灰度：`pnpm dev` 双后端可切。
4. **web**：新 UI 重构，对接新 server；Playwright 迁移并扩展为业务流 e2e。
5. **hub + cli**：本地核心 → CLI 命令面 → npm 首发。
6. **desktop**：Electron 壳 + hub 集成 + 市场/更新中心 → GitHub Release 首发（含 `ripple://` 注册）。
7. **收尾**：删除 Python 后端与旧 CLI，`/api/cli/version` 指向 npm，文档站上线。
8. **回滚**：切换前旧栈保持可运行；DB 新增表/删列迁移均含 down 迁移；桌面/CLI 出问题可回退到上一 Release/npm 版本。

## Open Questions

- ~~npm 包最终命名~~ 已确认：npm 包名为 `ripple`。
- GitHub 仓库归属（个人账号 hellosz vs 组织）与可见性（public/private）需用户确认——分发（npm + GitHub Release + codeload 拉仓库源）默认假设 public。
- 桌面客户端代码签名（macOS notarization / Windows 签名证书）暂不具备，首发接受未签名安装包（用户需手动允许）。
- 现有生产数据是否存在需要在切换窗口冻结写入的运营流程，切换时间窗待定。
