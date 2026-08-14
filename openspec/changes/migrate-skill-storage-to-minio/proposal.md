# Migrate Skill Storage to MinIO + PostgreSQL

## Why

Skill 文件目前有两处落盘，都存在结构性缺陷：

- 上传的原始 ZIP 通过 `store_uploaded_skill_package` 写入本地文件系统 `backend/storage/skill_packages/`。该目录未加入 `.gitignore`，二进制包会污染 Git 仓库，且多实例部署时本地磁盘无法共享。
- skill 源码树依赖 `skills/` 目录 + Git 提交（`copy_skill_to_repo` / `git_commit_skill`），文件浏览、正文预览、下载打包都从文件系统读取，导致文件内容与数据库元数据分离、无法对 SKILL.md 正文做全文搜索、备份分散。

在已定稿的决策下（MinIO sidecar + 单机部署 + pg_trgm 全文搜索 + 彻底脱离 Git），本次变更把 skill 二进制包迁移到 MinIO 对象存储，把文本文件内容结构化入库，并新增正文全文搜索能力。

## What Changes

- 引入 MinIO（docker-compose sidecar）作为 skill 原始 ZIP 包的对象存储。
- 新增 `skill_files` 表，上传时把 SKILL.md、agents 配置、scripts 等文本文件拆开入库，作为文件浏览与预览的唯一数据源。
- 下载优先从 MinIO 读取原始包，包缺失时从 `skill_files` 动态打包兜底。
- 版本历史由 `skill_versions` 表承担，移除对 Git 写入（commit/push）的依赖。
- 新增基于 pg_trgm + GIN 的全文搜索，命中 skill 名称、描述与正文。
- 重写 seed 脚本，把 `skills/` 目录内容灌入 `skill_files` 与 MinIO。

## Capabilities

### New Capabilities
- `skill-object-storage`: 定义 skill 二进制包的对象存储写入/读取、文本文件入库、文件浏览与下载行为。
- `skill-fulltext-search`: 定义基于 pg_trgm 的 skill 正文全文搜索行为。

### Modified Capabilities
- None.

## Impact

- 基础设施：`docker-compose.yml` 增加 `minio` 与 `minio-init` 服务；`backend/.env` 增加 MinIO 配置项。
- 后端：新增 `storage_service.py`（MinIO 封装）、`skill_files` 模型与迁移；改造上传/下载/读取/搜索逻辑；移除 `git_service` 的写操作。
- 数据：新增 `skill_files` 表与 trgm 索引；`skills.package_storage_path` 语义改为 MinIO object key；`skills.git_path` 废弃。
- 前端与 CLI：API 契约保持不变，无需改动（下载 URL 与文件树接口不变）。
