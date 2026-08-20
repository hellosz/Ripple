# 数据库工作流

- 中间件生命周期：`docker compose`（PostgreSQL 16 映射到宿主 **5433**、Redis 7、MinIO）
- Schema 迁移：`apps/server/drizzle/*.sql` + 自研轻量迁移器（`ripple_migrations` 记账表）
- Schema 声明：`apps/server/src/db/schema.ts`（Drizzle ORM）

## 全新数据库

```bash
pnpm docker:up
pnpm db:upgrade      # 依序执行 0000_baseline → 000N_*
```

## 接管旧版（Python/Alembic 时代）数据库

`0000_baseline.sql` 与旧 Alembic head（`20260813_0005`）等价，对存量库**只记账、不执行**：

```bash
# 1. 如库还没到 Alembic head（缺 skill_files/publish_channel），先用旧栈升到 head
#    （旧代码在 git 历史中：git show <migration-era-commit>:backend/...）
# 2. 标记 baseline 已应用（不执行 DDL）
pnpm db:stamp-baseline
# 3. 应用其余迁移（新表 + 遗留字段清理 + 存量库 parity）
pnpm db:upgrade
```

`0003_legacy_defaults_parity` 会补齐 SQLAlchemy 时代缺失的 DB 级默认值
（id 的 `gen_random_uuid()`、role/status/rating 等枚举默认与 NOT NULL），
对全新库幂等无副作用。

## 新增迁移

1. 修改 `apps/server/src/db/schema.ts`
2. 在 `apps/server/drizzle/` 新增 `NNNN_<name>.sql`（可选配 `NNNN_<name>.down.sql`）
3. `pnpm db:upgrade` 应用；迁移必须线性、可回滚，与代码同一 PR 交付

## 回滚

```bash
pnpm --dir apps/server exec tsx -e "import('./src/db/migrator.js').then(async m => console.log(await m.downgrade((await import('./src/config.js')).loadConfig().databaseUrl)))"
```

（回退最后一个已应用且带 down 文件的迁移。）

## 种子数据

e2e 种子由 `e2e/global-setup.ts` 幂等创建（管理员 + 技能 + 合辑）；
业务技能通过 `ripple publish` 或 Web 上传进入系统。
