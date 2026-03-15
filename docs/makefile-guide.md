# Makefile 命令指南

项目根目录下的 `Makefile` 封装了日常开发中常用的操作，执行 `make help` 可随时查看完整列表。

---

## 初始化

| 命令 | 说明 |
|------|------|
| `make install` | 一键安装前后端所有依赖（后端 `uv sync` + 前端 `npm install`） |
| `make env` | 从 `backend/.env.example` 创建 `backend/.env`，已存在则跳过 |

首次拉取项目后执行：

```bash
make env       # 创建配置文件，然后编辑 backend/.env 填入实际配置
make install   # 安装依赖
make db-init   # 建表（需先确保 PostgreSQL 可连接）
```

---

## 开发

| 命令 | 说明 |
|------|------|
| `make dev` | 同时启动后端（`:8000`）和前端（`:3000`），`Ctrl+C` 一次性停止 |
| `make dev-backend` | 仅启动后端，带 hot-reload |
| `make dev-frontend` | 仅启动前端 |

`make dev` 内部通过 `trap` 管理子进程，终止时自动清理。

---

## 数据库

| 命令 | 说明 |
|------|------|
| `make db-init` | 根据 SQLAlchemy 模型直接建表（适用于首次初始化） |
| `make db-migrate MSG='描述'` | 生成 Alembic 迁移文件（自动检测模型变更） |
| `make db-upgrade` | 执行所有未应用的迁移（`alembic upgrade head`） |
| `make db-downgrade` | 回滚最近一次迁移 |

典型工作流：

```bash
# 修改了 models/ 下的模型后
make db-migrate MSG='add avatar column to users'
make db-upgrade
```

---

## 代码质量

| 命令 | 说明 |
|------|------|
| `make lint` | 运行前端 ESLint 检查 |
| `make test` | 运行后端 pytest 测试 |

---

## 构建与部署

| 命令 | 说明 |
|------|------|
| `make build` | 构建前端生产版本（`next build`） |
| `make build-backend` | 构建后端 Docker 镜像（`ripple-backend`） |
| `make docker-up` | 通过 Docker Compose 启动所有服务 |
| `make docker-down` | 停止所有 Docker Compose 服务 |
| `make docker-logs` | 实时查看 Docker Compose 日志 |

---

## 依赖管理

| 命令 | 说明 |
|------|------|
| `make add PKG=redis` | 添加后端运行时依赖 |
| `make add-dev PKG=ruff` | 添加后端开发依赖 |
| `make lock` | 重新生成 `uv.lock`（通常在手动编辑 `pyproject.toml` 后使用） |

依赖管理使用 [uv](https://docs.astral.sh/uv/)，lockfile 位于 `backend/uv.lock`，应提交到 Git。

---

## 清理

| 命令 | 说明 |
|------|------|
| `make clean` | 删除 `__pycache__`、`.pytest_cache`、`.next`、`out` 等构建缓存 |
