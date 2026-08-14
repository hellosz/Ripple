# AGENTS.md

本文件是所有 AI 编码代理（Claude、Codex、Cursor 等）在本仓库工作时的统一约定。
**核心原则：需求开发必须先走 OpenSpec 流程，先对齐规格、再写代码。**

---

## 1. 项目概览

**Ripple** — AI Skill 分享平台：发现、预览、下载和传播高质量的 AI Agent 技能包。

| 层 | 技术 |
|---|---|
| 前端 | Next.js 15 (App Router)、React 19、TypeScript、Tailwind CSS、framer-motion、shiki |
| 后端 | FastAPI、SQLAlchemy 2.0 (async)、Alembic、pydantic v2（Python 3.12+） |
| 数据 | PostgreSQL 16 + Redis 7（Docker Compose）+ MinIO（S3 对象存储） |
| 认证 | JWT（python-jose）+ bcrypt |
| 包管理 | pnpm workspace（前端/CLI）+ uv（后端） |

```
ripple/
├── frontend/          # Next.js 前端
├── backend/           # FastAPI 后端（app/api、app/models、app/services、app/schemas）
├── cli/               # Ripple CLI（npx 安装技能）
├── skills/            # skill 文件存储（seed 数据来源）
├── openspec/          # OpenSpec 规格与变更（changes/、specs/）
├── docker/            # PostgreSQL initdb 脚本
└── docs/              # 文档（含 database-workflow.md）
```

---

## 2. 开发环境与常用命令

### 环境准备

```bash
pnpm docker:up        # 启动 PostgreSQL + Redis + MinIO（Docker Compose）
pnpm env              # 首次：从 .env.example 生成 backend/.env
pnpm setup            # 安装后端依赖（uv）并同步前端
pnpm db:upgrade       # 应用 Alembic 迁移到 head
pnpm db:seed          # 导入 seed 数据
pnpm dev              # 后端 :8000 + 前端 :3000
```

### 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 同时启动前后端 |
| `pnpm dev:backend` / `pnpm dev:frontend` | 单独启动后端/前端 |
| `pnpm db:upgrade` | `alembic upgrade head` |
| `pnpm db:migrate "描述"` | `alembic revision --autogenerate`（改模型后生成迁移） |
| `pnpm db:downgrade` | 回退一个迁移 |
| `pnpm db:seed` | 运行 `backend/seed_skills.py` |
| `pnpm test` | 后端 pytest（`backend/tests/`） |
| `pnpm lint` | 前端 ESLint |
| `pnpm build` | 前端构建 |
| `pnpm docker:down` | 停止中间件 |

> 后端单独操作：`cd backend && uv run <command>`（如 `uv run pytest`、`uv run alembic ...`）。

---

## 3. 需求开发流程（OpenSpec）

### 3.1 原则

- **先规格、后实现**：任何非平凡变更，先写 OpenSpec 变更（change），与需求方对齐后再动手写代码。
- **规格是契约**：`specs/` 描述「做什么」（WHAT），`design.md` 描述「怎么做」（HOW），`tasks.md` 是实施清单。
- **流式迭代，不僵化**：任何产物都可随时更新，没有硬性阶段门禁；实现中发现设计问题，回头改规格。

### 3.2 工具

使用 `@fission-ai/openspec`（v1.2+，已在 devDependencies）。运行方式：

```bash
pnpm exec openspec <command>     # 推荐
# 或 npx openspec <command>
```

当前 schema 为 `spec-driven`，产物顺序：`proposal → specs → design → tasks`。

### 3.3 目录约定

```
openspec/
├── changes/                      # 活跃变更
│   └── <change-name>/            # kebab-case 命名，如 migrate-skill-storage-to-minio
│       ├── .openspec.yaml        # schema: spec-driven + created 日期
│       ├── proposal.md           # 为什么做、做什么
│       ├── specs/                # 增量规格（每能力一个文件）
│       │   └── <capability>/spec.md
│       ├── design.md             # 技术方案（可选，复杂变更必写）
│       ├── tasks.md              # 实施清单（checkbox）
│       └── audit.md              # 变更审计（Before/After，项目约定）
├── specs/                        # 主规格（archive 后更新，长期事实来源）
└── changes/archive/              # 已归档变更（YYYY-MM-DD-<name>）
```

### 3.4 完整流程（六步）

#### 第 0 步：判断是否需要 OpenSpec

| 场景 | 做法 |
|---|---|
| 新功能、架构变更、跨模块改造、数据模型变更、破坏性变更 | **必须**建 change |
| Bug 修复（小）、拼写、样式微调、配置调整 | 直接改，不必建 change |
| 需求探索/方案调研 | 先讨论，成熟后再建 change（可参考 `.codex/skills/openspec-explore/`） |

#### 第 1 步：创建变更（propose）

```bash
pnpm exec openspec new change "<change-name>"      # kebab-case
```

然后依次生成产物（可用 `pnpm exec openspec instructions <artifact> --change "<name>"` 获取该产物的官方撰写指导）：

1. **proposal.md** — 回答「为什么 + 改什么」：
   - `## Why`：问题/机会（1-2 句）
   - `## What Changes`：变更清单，破坏性变更标注 **BREAKING**
   - `## Capabilities`：**New Capabilities**（每个对应一个 `specs/<name>/spec.md`）+ **Modified Capabilities**（仅当规格级行为变化，需写 delta spec；检查 `openspec/specs/` 现有名称）
   - `## Impact`：影响的代码/API/依赖/系统
2. **specs/<capability>/spec.md** — 每个 proposal 列出的能力写一个规格文件，描述「做什么」。
3. **design.md** — 复杂变更写技术方案（跨模块、新依赖、数据模型、安全/性能/迁移复杂度时必写）。
4. **tasks.md** — 实施清单。

> 创建过程用 `pnpm exec openspec status --change "<name>" --json` 跟踪产物完成度，直到 `apply` 所需的产物全部 `done`。

#### 第 2 步：校验（validate）

```bash
pnpm exec openspec validate --all          # 校验所有变更和规格
pnpm exec openspec validate "<change-name>" # 校验单个变更
```

**校验不通过不允许进入实现。**

#### 第 3 步：实施（apply）

```bash
pnpm exec openspec status --change "<name>"       # 查看任务进度
pnpm exec openspec instructions apply --change "<name>" --json  # 获取实施上下文
```

- 读上下文文件（proposal / specs / design / tasks），按 `tasks.md` 逐条实施。
- 每完成一条，立即把 `- [ ]` 改为 `- [x]`。
- 遇到阻塞/歧义，暂停并向需求方澄清，**不要猜测**。
- 实现中发现设计问题，回头更新 `design.md`/`specs/`（流式迭代）。

#### 第 4 步：补审计（audit，项目约定）

每个 change 完成后写 `audit.md`，记录：
- **Before This Change**：改造前的实现与行为
- **Gaps Identified**：识别到的缺口
- **Implemented Contract**：改造后落地的契约

#### 第 5 步：归档（archive）

```bash
pnpm exec openspec archive "<change-name>"
# 纯基础设施/工具/文档变更（不改变规格行为）加 --skip-specs
```

归档会把 change 移到 `changes/archive/YYYY-MM-DD-<name>/`，并把 delta specs 同步进 `openspec/specs/`（长期事实来源）。

---

## 4. 产物格式要求（关键规则）

### spec.md

- 用 `## ADDED Requirements` / `## MODIFIED Requirements` / `## REMOVED Requirements` / `## RENAMED Requirements` 分组。
- 每个需求：`### Requirement: <名称>` + 一段描述，**用 SHALL/MUST**（避免 should/may）。
- 每个场景：`#### Scenario: <名称>`（**必须是 4 个 `#`**，3 个 `#` 会静默失败），内容用 `- **WHEN** ...` / `- **THEN** ...`。
- **每个 Requirement 至少一个 Scenario**。
- MODIFIED 需求必须粘贴**完整**更新后的需求块（含所有 scenario），避免归档时丢失细节。

```markdown
## ADDED Requirements

### Requirement: 用户可导出数据
系统 SHALL 允许用户导出 CSV 格式的数据。

#### Scenario: 成功导出
- **WHEN** 用户点击「导出」按钮
- **THEN** 系统下载包含全部用户数据的 CSV 文件
```

### tasks.md

- 用 `## N. 任务组` 分组。
- 每一条必须是 checkbox：`- [ ] N.M 任务描述`（apply 阶段靠它解析进度）。
- 按依赖顺序排列，每条要可验证（做完能明确判断）。

```markdown
## 1. Setup

- [ ] 1.1 创建新模块结构
- [ ] 1.2 添加依赖

## 2. Core Implementation

- [ ] 2.1 实现导出函数
- [ ] 2.2 添加 CSV 工具
```

### design.md

- 章节：`Context` / `Goals / Non-Goals` / `Decisions`（含「为什么选 X 而非 Y」，附 alternatives）/ `Risks / Trade-offs`（格式 `[风险] → 缓解`）/ `Migration Plan`（含 rollback）/ `Open Questions`。

### proposal.md

- 章节：`Why` / `What Changes` / `Capabilities`（New + Modified）/ `Impact`。聚焦「why」，不写实现细节。

---

## 5. OpenSpec CLI 速查

| 命令 | 用途 |
|---|---|
| `openspec list [--specs]` | 列出活跃变更（或规格） |
| `openspec new change <name>` | 创建变更目录 |
| `openspec status --change <name> [--json]` | 查看产物/任务完成状态 |
| `openspec instructions <artifact> --change <name>` | 获取某产物的撰写指导 |
| `openspec validate [--all\|<name>]` | 校验变更/规格 |
| `openspec show <name>` | 查看变更/规格 |
| `openspec archive <name> [--skip-specs]` | 归档并同步主规格 |
| `openspec templates` | 查看各产物模板路径 |

---

## 6. 代码规范与注意事项

### 后端（backend/）

- 模型变更必须配套 Alembic 迁移：改 `app/models/` → `pnpm db:migrate "描述"` → 检查迁移 → `pnpm db:upgrade`。
- 分层：`api/`（路由）→ `services/`（业务逻辑）→ `models/`（ORM）→ `schemas/`（Pydantic）。
- 数据库访问用 async SQLAlchemy（`AsyncSession`）；新增模型记得在 `app/models/__init__.py` 注册。
- skill 存储：二进制包走 MinIO（`app/services/storage_service.py`），文本文件内容走 `skill_files` 表；**不再依赖 Git 文件系统**。
- 测试放在 `backend/tests/`，用 pytest；纯逻辑优先用无副作用单元测试。

### 前端（frontend/）

- API 封装统一走 `frontend/src/lib/api.ts`，不要在各组件里散落 fetch。
- 组件按领域放 `src/components/<domain>/`，页面放 `src/app/`。

### 通用

- 提交信息用 conventional commits：`type(scope): subject`（如 `feat(skills): ...`）。
- 破坏性变更在 proposal 与提交信息中明确标注。
- 不提交 `.env`、`node_modules`、`.next`、构建产物、`backend/.venv`。
