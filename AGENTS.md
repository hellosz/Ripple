# AGENTS.md

本文件是所有 AI 编码代理（Claude、Codex、Cursor 等）与人类协作者在本仓库工作时的统一约定，包含**系统规范**（架构、技术栈、代码/API/数据库/测试标准）与**开发工作流**（OpenSpec、分支与 PR、发布）。
**核心原则：需求开发必须先走 OpenSpec 流程，先对齐规格、再写代码。**

> **过渡期说明**：本文件描述 `ripple-ts-rewrite` 变更（见 `openspec/changes/ripple-ts-rewrite/`）确立的 TypeScript 全栈目标架构。在该变更完成切换前，仓库中仍存在旧结构（`backend/` FastAPI、`frontend/` 旧版、`cli/` 旧版）；旧栈只做保运行的最小修改，一切新开发面向新架构。旧栈的开发命令见 git 历史中的旧版 AGENTS.md 与 `README.md`。

---

## 1. 项目概览

**Ripple** — AI Skill 分享平台：发现、预览、下载和传播高质量的 AI Agent 技能包。三端形态：Web 社区、跨平台桌面客户端（Linux/macOS/Windows）、CLI（npm 包名 `ripple`）。

| 层 | 技术 |
|---|---|
| 语言/运行时 | TypeScript（strict）全栈，Node ≥ 20，pnpm workspace |
| 服务端 | Fastify + zod（contract 单一来源）+ Drizzle ORM（PostgreSQL） |
| Web | Next.js 15 (App Router)、React 19、Tailwind CSS |
| 桌面 | Electron + electron-vite + React（复用 `packages/ui`），electron-builder / electron-updater |
| CLI | commander，tsup 单文件产物，npm 包名 `ripple`（bin `ripple`） |
| 数据 | PostgreSQL 16 + Redis 7 + MinIO（S3 兼容，Docker Compose 托管） |
| 认证 | JWT（HS256）+ OAuth 设备码流程（CLI/桌面） |
| 测试 | vitest（单元/集成）+ Playwright（Web e2e） |
| 分发 | CLI → npm registry；桌面 → GitHub Release；版本 → changesets |

### 仓库布局（monorepo）

```
ripple/
├── apps/
│   ├── server/      # Fastify API 服务
│   ├── web/         # Next.js Web 社区
│   ├── desktop/     # Electron 桌面客户端
│   └── cli/         # ripple CLI
├── packages/
│   ├── contract/    # zod schema + API 类型契约（唯一事实来源）
│   ├── api-client/  # 类型安全 HTTP/SSE client（web/desktop/cli 共享）
│   ├── skill-core/  # SKILL.md 解析/校验/评级（server 与本地端共享）
│   ├── hub/         # 本地技能管理核心（desktop/cli 共享，Node-only）
│   └── ui/          # 共享 React 组件与设计 token（web/desktop 共享）
├── e2e/             # Playwright 测试
├── openspec/        # OpenSpec 规格与变更（changes/、specs/）
├── docker/          # 中间件 initdb 等
└── .github/workflows/  # CI 与发布流水线
```

### 依赖方向规则（强约束）

- `apps/*` 可以依赖 `packages/*`；**`packages/*` 禁止依赖 `apps/*`**。
- packages 内部方向：`contract` 零依赖 → `api-client`/`skill-core` 依赖 `contract` → `hub` 依赖 `skill-core`、`api-client` → `ui` 只依赖 `contract`。禁止反向、禁止环。
- 浏览器端代码（`web`、desktop 渲染进程、`ui`）**禁止引入 Node-only 包**（`hub`、fs 相关）；desktop 渲染进程经类型化 IPC 调主进程。
- 任何跨端共享逻辑必须落在 packages，不允许在两个 app 里复制实现。

---

## 2. 系统规范

### 2.1 TypeScript 与代码风格

- `strict: true`，禁止 `any` 逃逸（确需时 `unknown` + 收窄）；公共 API 一律显式返回类型。
- ESM only；包内导入用相对路径，跨包用包名（`@ripple/contract` 等 workspace 别名）。
- 校验与类型的唯一来源是 `packages/contract` 的 zod schema：服务端入参出参、client、CLI `--json` 输出结构都从这里推断，**不允许手写重复的 interface**。
- 错误处理：服务端业务错误统一错误体 `{ error: { code, message } }`；CLI 人类可读信息走 stderr，stdout 只留数据。
- 命名：文件 kebab-case；类型 PascalCase；数据库 snake_case；API 路径 kebab/复数名词。
- lint/format：eslint + prettier，根级配置，CI 强制。

### 2.2 API 规范（apps/server）

- REST，前缀 `/api/`；路由按域组织（auth/users/skills/interactions/ripples/sse/admin/collections）。
- 鉴权三档装置：必须登录 / 可选登录 / admin；被禁用用户一律 403。
- 所有端点用 zod schema 声明请求与响应（fastify-type-provider-zod），自动产出 OpenAPI 文档。
- 列表接口必须聚合查询，禁止每行 N+1；分页参数统一 `page`/`page_size`。
- SSE：`/api/sse/notifications?token=`，30s 心跳，跨实例走 Redis pub/sub，Redis 不可用降级本实例。
- 灰度：`publish_channel = production | gray`，gray 仅 admin 可见。

### 2.3 数据库规范

- Drizzle ORM，schema 声明在 `apps/server` 的 db 模块；迁移用 drizzle-kit，**线性追加、每个迁移可回滚**。
- 对既有生产库：baseline 迁移只 stamp 不执行（历史由 Alembic 时代延续）。
- 表/列 snake_case，主键 UUID；模型变更必须与迁移同一 PR 交付。
- 破坏性 schema 变更（删列/删表）必须独立迁移并在 OpenSpec change 中声明 **BREAKING**。

### 2.4 技能包规范（skill-core，三端共享）

- 技能包 = 含 `SKILL.md` 的目录/ZIP；frontmatter 必填 `name`（kebab-case，全局唯一）+ `description`，可选 `version`（缺省 1.0.0）/`display_name`/`category`/`tags`。
- ZIP 校验：合法性、路径穿越防护、≤10MB；解压/打包用纯 Node 实现（禁止依赖系统 `zip/unzip/git`）。
- 自动评级 S/A/B/C 规则与改进建议以 `packages/skill-core` 的表驱动测试为准，改规则先改测试。

### 2.5 本地技能管理规范（hub）

- SSOT 中心存储：默认 `~/.ripple/skills/`，可切换 `~/.agents/skills/`，切换必须平滑迁移。
- 分发：symlink（Windows 目录用 junction）→ 失败自动降级 copy 并明示；状态文件原子写。
- 更新/同步/卸载前自动备份（`~/.ripple/backups/`，全局保留 20 份 FIFO）；操作历史可回退。
- 新增 Agent 支持只允许通过适配器注册表条目扩展，不改核心逻辑。

### 2.6 测试规范

- 单元测试（vitest）与被测代码同包放置；纯逻辑优先无副作用单测。
- server 必须有 API 集成测试覆盖 spec 的 Scenario（认证、上传下载、互动前置、推送投递、灰度、SSE）。
- hub 必须覆盖三平台路径语义（含 Windows 降级）、备份保留、同步收敛。
- Web 业务流走 Playwright（`e2e/`）；桌面端维护冒烟清单，能自动化的进 CI。
- **CI 红灯禁止合并**；修 bug 先补失败测试再修。

### 2.7 安全与配置

- 不提交 `.env`、token、构建产物；secrets 走 GitHub Actions secrets（NPM_TOKEN 等）。
- 配置经环境变量注入（键名延续现有 `.env.example`）；CLI 配置分层：参数 > 环境变量（`RIPPLE_SERVER`/`RIPPLE_TOKEN`）> `~/.ripplerc` > 默认。
- 一切外部输入（上传包、GitHub tarball、ZIP 导入）落盘前必须过 skill-core 校验。

---

## 3. 开发环境与常用命令

```bash
pnpm docker:up        # 启动 PostgreSQL + Redis + MinIO
pnpm env              # 首次：生成 .env
pnpm install          # 安装 workspace 依赖
pnpm db:upgrade       # 应用数据库迁移
pnpm dev              # server :8000 + web :3000
```

| 命令 | 说明 |
|---|---|
| `pnpm dev` / `pnpm dev:server` / `pnpm dev:web` / `pnpm dev:desktop` | 启动开发 |
| `pnpm db:generate "描述"` / `pnpm db:upgrade` | 生成 / 应用 Drizzle 迁移 |
| `pnpm test` / `pnpm test:e2e` | vitest / Playwright |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | 全仓校验与构建 |
| `pnpm changeset` | 记录版本变更（发布用） |

---

## 4. 需求开发流程（OpenSpec）

### 4.1 原则

- **先规格、后实现**：任何非平凡变更，先建 OpenSpec change，对齐后再写代码。
- **规格是契约**：`specs/` 描述 WHAT，`design.md` 描述 HOW，`tasks.md` 是实施清单。
- **流式迭代**：产物可随时更新；实现中发现设计问题，回头改规格。

### 4.2 何时需要 change

| 场景 | 做法 |
|---|---|
| 新功能、架构变更、跨模块改造、数据模型变更、破坏性变更 | **必须**建 change |
| 小 bug 修复、拼写、样式微调、配置调整 | 直接改 |
| 需求探索/方案调研 | 先讨论（`/opsx:explore`），成熟后建 change |

### 4.3 流程（六步）

工具：`pnpm exec openspec <command>`（schema `spec-driven`，产物顺序 proposal → specs → design → tasks）。

1. **propose**：`openspec new change "<kebab-name>"`，依次写 `proposal.md`（Why / What Changes / Capabilities / Impact）、`specs/<capability>/spec.md`、`design.md`（复杂变更必写：Context / Goals / Decisions 含备选 / Risks / Migration / Open Questions）、`tasks.md`。用 `openspec instructions <artifact> --change <name>` 获取撰写指导，`openspec status` 跟踪完成度。
2. **validate**：`openspec validate --all`，**不通过不允许进入实现**。
3. **apply**：按 `tasks.md` 逐条实施，完成一条立即勾选 `- [x]`；遇歧义暂停澄清，不猜测。
4. **audit**（项目约定）：完成后写 `audit.md`（Before This Change / Gaps Identified / Implemented Contract）。
5. **archive**：`openspec archive "<name>"`（纯工具/文档变更加 `--skip-specs`），delta specs 同步进 `openspec/specs/`（长期事实来源）。
6. 归档后如约定有变，同步更新本文件（AGENTS.md 是规范的维护处）。

### 4.4 产物格式硬性要求

- **spec.md**：`## ADDED|MODIFIED|REMOVED|RENAMED Requirements` 分组；`### Requirement: <名>` 用 SHALL/MUST；每个需求至少一个 `#### Scenario:`（**必须 4 个 `#`**），内容 `- **WHEN**` / `- **THEN**`；MODIFIED 必须粘贴完整更新后的需求块。
- **tasks.md**：`## N. 组名` + `- [ ] N.M 描述` checkbox（apply 靠它解析进度），按依赖排序、条条可验证。
- **proposal.md**：聚焦 why，不写实现细节；破坏性变更标注 **BREAKING**。

### 4.5 OpenSpec CLI 速查

| 命令 | 用途 |
|---|---|
| `openspec list [--specs]` | 列出活跃变更（或规格） |
| `openspec new change <name>` | 创建变更 |
| `openspec status --change <name> [--json]` | 产物/任务状态 |
| `openspec instructions <artifact> --change <name>` | 产物撰写指导 |
| `openspec validate [--all\|<name>]` | 校验 |
| `openspec archive <name> [--skip-specs]` | 归档并同步主规格 |

---

## 5. 分支、提交与发布工作流

### 5.1 分支与 PR（GitHub）

- 主分支 `main` 受保护；开发走 `feature/<topic>`、修复走 `fix/<topic>`，PR 合入 `main`。
- PR 必须：关联的 OpenSpec change（如适用）、CI 绿灯（lint + typecheck + vitest + build + e2e）、描述含变更摘要。
- 提交信息用 conventional commits：`type(scope): subject`（如 `feat(server): ...`、`fix(hub): ...`）；破坏性变更加 `!` 或 `BREAKING CHANGE:` 脚注。

### 5.2 版本与发布

- 版本由 changesets 管理：功能 PR 附 changeset；发布 PR 合并后打 `v*` tag。
- tag 触发发布流水线：
  - **CLI**：`release-cli.yml` 构建单文件并 `npm publish`（包名 `ripple`）。
  - **桌面**：`release-desktop.yml` 三平台矩阵（Linux AppImage+deb / macOS dmg / Windows nsis）上传 GitHub Release（含 electron-updater 元数据）。
- 服务端与 Web 的部署按环境流程另行执行（见 `docs/`）；数据库迁移随部署前置执行且必须可回滚。

---

## 6. 注意事项

- API 封装统一走 `packages/api-client`，禁止在组件/命令里散落 fetch。
- Web 组件按领域放 `apps/web/src/components/<domain>/`；可复用视觉件下沉 `packages/ui`。
- 热度公式（传播×1 + 收藏×2 + 评论×4 + 查询×0.05，周归一化）的实现与展示口径以 `openspec/changes/ripple-ts-rewrite/specs/server-api/spec.md` 为准。
- 不提交 `.env`、`node_modules`、`.next`、`dist/`、Playwright 产物。
- 本文件（AGENTS.md）是系统规范与工作流的唯一维护处；`CLAUDE.md` 仅作指针，不要在其中新增规则。
