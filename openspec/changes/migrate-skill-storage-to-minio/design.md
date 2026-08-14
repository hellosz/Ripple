# Design: Migrate Skill Storage to MinIO + PostgreSQL

## Context

Ripple 当前把 skill 的源码树托管在 Git 仓库的 `skills/` 目录，上传时写文件 + Git commit，同时 `feature/enhance` 分支已引入"上传契约"，把原始 ZIP 落盘到 `backend/storage/skill_packages/` 并在 `skills`/`skill_versions` 上持久化 `package_file_name` / `package_storage_path` / `package_checksum`。

这些演进带来了两个新的技术债：二进制包混入 Git/本地磁盘、文件内容与元数据分离导致无法对正文搜索。本次变更在既有上传契约的基础上，把二进制包迁到 MinIO、把文本内容入库、并补齐全文搜索，彻底脱离 Git 文件系统。

## Goals / Non-Goals

**Goals:**
- 用 MinIO（docker-compose sidecar）作为 skill 原始 ZIP 的单一对象存储，支持流式下载与完整性校验。
- 用 `skill_files` 表存储 skill 文本文件内容，作为文件浏览、正文预览的唯一数据源。
- 下载优先使用 MinIO 原始包，缺失时从 `skill_files` 动态打包兜底，保持 `GET /api/skills/{slug}/download` 与文件树/内容接口的 API 契约不变。
- 让版本历史完全由 `skill_versions` 承担，移除 `git_service` 的 commit/push 写操作。
- 通过 pg_trgm + GIN 索引让 `search` 参数命中名称、描述与 SKILL.md 正文。

**Non-Goals:**
- 不改动前端与 CLI（API 契约不变）。
- 不在本次实现中文分词扩展（zhparser）或全文排序权重调优。
- 不处理二进制资源文件（图片等）的内容检索，仅按需保留在 MinIO 包内。
- 不迁移既有部署的历史数据（本轮以新写入路径为准，seed 脚本负责重建演示数据）。

## Decisions

### 1. 二进制包存 MinIO，而不是数据库 BYTEA
MinIO 是 S3 兼容、开源自托管、单二进制部署，天然支持 presigned URL、版本控制、生命周期，且多实例可共享。skill ZIP 属于不可变的二进制工件，适合对象存储；塞进 PostgreSQL BYTEA 会造成 TOAST 膨胀与流式下载复杂度。

Alternative considered: PostgreSQL Large Object / BYTEA。Rejected because 大二进制在关系库中维护成本高、下载流式返回繁琐，且与对象存储相比无扩展优势。

### 2. 文本文件拆开入库 `skill_files`
skill 的核心价值是文本（SKILL.md、agents/*.yaml、scripts、references），这些需要按文件浏览、按语言高亮、并被全文搜索。上传时把文本文件拆成行记录入库，二进制文件跳过（保留在 MinIO 包内）。

Alternative considered: 只存 ZIP、按需解压解析。Rejected because 每次读取都解压、无法建搜索索引、文件树读取耦合到对象存储。

### 3. MinIO 访问用 boto3
boto3 是 S3 兼容的事实标准，未来切换到云 S3（AWS/GCS/OSS 兼容层）无需改代码，生态与文档优于 minio 专用 SDK。

Alternative considered: `minio` Python SDK。Rejected because 绑定 MinIO 协议细节，可移植性弱于 boto3。

### 4. 全文搜索用 pg_trgm + GIN
skill 正文是中英混合，PostgreSQL 默认 tsvector 英文分词对中文不生效；pg_trgm 按 3 字符 trigram 匹配，中英文均适用，且是官方 contrib 扩展、零编译，docker 官方 PG 镜像自带。

Alternative considered: zhparser / pg_jieba 中文分词。Rejected as first iteration because 需要编译扩展 + 自定义镜像，运维成本高；trgm 在当前内容量下足够，后续可平滑升级。

### 5. 版本历史由 `skill_versions` 承担
`skill_versions` 已记录 version、changelog、rating、git_commit_sha 与上传契约字段。本轮把 `skill_files` 按 `(skill_id, version)` 建立快照关系，使历史版本的文件内容可追溯；`git_commit_sha` 保留但不再依赖 Git 提交产生。

Alternative considered: 继续 Git 管理源码树作为版本来源。Rejected by product decision：彻底脱离 Git，减少文件系统耦合。

### 6. 下载兜底策略
下载优先读 MinIO 原始包（`package_storage_path` 指向 object key，`package_checksum` 校验）。若对象缺失（如历史数据），从 `skill_files` 当前版本动态打包。这保证接口不因迁移而中断。

## Risks / Trade-offs

- [MinIO 单点] → Mitigation: 单机部署阶段以 volume 持久化；docker-compose 统一生命周期管理，未来可换高可用 S3。
- [全文搜索精度] → Mitigation: pg_trgm 提供召回而非精准分词，前端保持 name/description 精确匹配 + 正文模糊召回的组合。
- [存量数据迁移] → Mitigation: 迁移只加表不改旧行；seed 脚本幂等重建演示数据；`git_path` 保留列避免破坏旧记录读取。
- [上传时入库失败导致部分写入] → Mitigation: 文本入库 + MinIO 写入 + 元数据更新在同一请求事务内完成；对象写入失败则整体回滚。
- [大 skill 包拆分入库的体积] → Mitigation: 仅文本文件入库，二进制跳过；`content` 只存可解码 UTF-8 的文本。

## Migration Plan

1. docker-compose 增加 MinIO 与 minio-init（建 bucket），`.env` 增加 MinIO 配置。
2. 新增迁移 `0004_skill_files_and_fulltext_search`：建 `skill_files` 表、启用 pg_trgm、建 GIN 索引。
3. 新增 `storage_service.py` 封装 MinIO put/get/delete/exists。
4. 改造 `skill_service.py`：上传拆文本入库 + 原始包写 MinIO；下载改读 MinIO；文件树/内容改读 `skill_files`。
5. 改造 `api/skills.py`：文件树/文件内容/下载路由消费新数据源；搜索命中正文。
6. 移除 `git_service` 写操作，重写 `seed_skills.py` 灌入 `skill_files` + MinIO。
7. 补测试：上传入库、下载兜底、全文搜索命中。

Rollback strategy: 保留 `git_path` 与旧文件读取路径为 fallback，关闭 MinIO 相关配置时回退到仓库打包下载；新表可独立 drop 不影响既有读写。

## Open Questions

- MinIO 是否需要 presigned URL 下载，还是后端流式代理？（首轮采用后端流式代理，保持鉴权一致）
- `skill_files` 是否需要在同一 skill 多版本之间做差异存储以节省空间？
- 是否需要把二进制资源也纳入 `skill_files` 的元数据（仅存 path/size/hash，内容留在 MinIO）？
