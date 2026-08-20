# Ripple

AI Skill 分享平台 — 发现、预览、下载与传播高质量的 AI Agent 技能包。

**One Drop, Endless Ripples.**

三端形态：

| 端 | 位置 | 分发 |
|---|---|---|
| Web 社区 | `apps/web`（Next.js 15） | 自部署 |
| 服务端 API | `apps/server`（Fastify + Drizzle + PostgreSQL/Redis/MinIO） | 自部署 / Dockerfile |
| 桌面客户端 | `apps/desktop`（Electron，Linux/macOS/Windows） | [GitHub Release](https://github.com/hellosz/Ripple/releases) |
| CLI | `apps/cli` | `npm i -g @hellosz/ripple`（命令名 `ripple`） |

共享包：`packages/contract`（zod API 契约）、`packages/api-client`、`packages/skill-core`（SKILL.md 校验/评级）、`packages/hub`（本地技能管理核心：SSOT 存储、symlink 分发、多 Agent 适配、备份回退）、`packages/ui`。

## Quick Start

```bash
pnpm docker:up        # 启动 PostgreSQL(:5433) + Redis + MinIO
pnpm env              # 首次：生成 apps/server/.env
pnpm install          # 安装 workspace 依赖
pnpm db:upgrade       # 应用数据库迁移（全新库执行全部迁移）
pnpm dev              # server :8010 + web :3000
```

> 接管旧版（Alembic 时代）数据库：先 `pnpm db:stamp-baseline`（baseline 只记账不执行），再 `pnpm db:upgrade`。详见 [docs/database-workflow.md](docs/database-workflow.md)。

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` / `dev:server` / `dev:web` / `dev:desktop` | 开发 |
| `pnpm db:upgrade` / `db:stamp-baseline` | 数据库迁移 / 存量库接管 |
| `pnpm lint` / `pnpm typecheck` | 全仓静态检查 |
| `pnpm test` | vitest（单元 + server 集成 + CLI 集成，120+ 用例） |
| `pnpm test:e2e` | Playwright 业务流 e2e（自动拉起 server + web） |
| `pnpm build` | 全仓构建 |
| `pnpm changeset` | 记录版本变更 |

## 功能

- 技能浏览、全文搜索（含包内文件正文）、分类/标签/评级筛选
- 热度体系：传播×1 + 收藏×2 + 评论×4 + 查询×0.05，按周归一化
- 技能上传自动校验与 S/A/B/C 评级（含改进建议）、版本管理、灰度发布
- RP（Ripple Push）随机传播推送 + SSE 实时通知（多实例 Redis pub/sub）
- 嵌套评论、合辑（Collections）、关注作者、AI 生成用户画像
- 本地技能管理（桌面 + CLI）：SSOT 中心存储、symlink/复制分发、多 Agent 适配器、
  版本一致性检测、自动备份与任意版本回退、GitHub 仓库/ZIP 离线来源
- `ripple://` Deep Link：网页一键唤起桌面客户端安装

## 开发流程

需求开发走 OpenSpec（先规格后实现），系统规范与工作流见 [AGENTS.md](AGENTS.md)。

## 发布

- CLI：打 tag `cli-v<version>` → GitHub Actions 发布到 npm（`@hellosz/ripple`）
- 桌面：打 tag `desktop-v<version>` → 三平台矩阵构建上传 GitHub Release（electron-updater 自动更新）
- 发版前人工过一遍 [docs/desktop-smoke-checklist.md](docs/desktop-smoke-checklist.md)
