# 数据库初始化与迭代方案

当前仓库推荐把数据库管理拆成两层：

1. `docker compose` 负责中间件生命周期管理。
2. `Alembic` 负责应用表结构版本化。

这样可以同时解决“新环境快速初始化”和“后续表/字段持续演进”两个问题。

## 1. 中间件容器管理

项目根目录新增了 `docker-compose.yml`，当前包含：

- `postgres:16`
- `redis:7`

启动方式：

```bash
pnpm docker:up
```

停止方式：

```bash
pnpm docker:down
```

查看日志：

```bash
pnpm docker:logs
```

## 2. 首次初始化：哪部分放 init SQL

`docker/postgres/initdb/*.sql` 会在 PostgreSQL 数据目录为空时执行一次，适合放：

- 扩展安装
- schema 初始化
- 固定的基础库级对象

当前示例：

- `docker/postgres/initdb/001_extensions.sql`

注意：

- 这类脚本只在全新数据卷首次启动时执行。
- 已存在的 `postgres_data` volume 不会再次执行这些脚本。
- 不建议把后续会频繁变化的业务表结构长期维护在这里。

如果确实要重跑 init SQL，需要删除数据库 volume 后重新启动。

## 3. 推荐的表结构初始化方式

业务表结构推荐统一交给 Alembic：

```bash
pnpm db:upgrade
```

当前仓库已经补了首个基线迁移：

- `backend/migrations/versions/20260316_0001_initial_schema.py`

这意味着新库初始化流程可以直接走：

```bash
pnpm docker:up
pnpm env
pnpm install
pnpm setup:backend
pnpm setup:frontend
pnpm setup
pnpm db:upgrade
pnpm db:seed
```

如果希望一步完成迁移和基础数据导入，可以执行：

```bash
pnpm db:bootstrap
```

## 4. 初始化数据方式

数据初始化建议分两类：

1. 固定、强幂等的基础数据：可以写 SQL 脚本。
2. 依赖业务上下文的数据：建议写成 seed 脚本。

当前项目已有：

- `backend/seed_skills.py`

它更适合做可重复执行的数据导入，因为可以写幂等逻辑，比如“存在则跳过”。

## 5. 后续字段、表更新的标准流程

后续所有表结构变更都建议只走 Alembic，不再改 init SQL：

1. 修改 `backend/app/models/` 下的模型。
2. 生成迁移：

```bash
cd backend && UV_CACHE_DIR=/tmp/uv-cache uv run alembic revision --autogenerate -m 'add avatar column to users'
```

3. 检查迁移文件是否符合预期。
4. 执行迁移：

```bash
pnpm db:upgrade
```

5. 如果涉及存量数据修复，在迁移文件里补数据迁移逻辑，或者单独增加 seed/data migration。

## 6. 这套方案的边界

推荐方案：

- `initdb SQL` 只负责数据库容器首次启动的底座初始化。
- `Alembic` 负责所有业务表结构版本演进。
- `seed 脚本` 负责初始化数据和补充演示数据。

不推荐方案：

- 把完整业务表结构长期维护在 `initdb/*.sql`
- 上线后继续手工改库，再回头补代码
- 应用启动时自动 `create_all`

原因是这些做法都会让环境之间的结构版本难以对齐。
