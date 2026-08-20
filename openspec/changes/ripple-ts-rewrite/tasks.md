# Tasks: ripple-ts-rewrite

## 1. 仓库迁移与 Monorepo 骨架

- [x] 1.1 在 GitHub 创建仓库 Ripple（确认归属账号/组织与可见性），`git push --mirror` 迁移全部历史与分支标签，切换 origin，保留 GitLab 为 `gitlab` 只读远端
- [x] 1.2 建立 pnpm workspace 骨架：`apps/{server,web,desktop,cli}`、`packages/{contract,api-client,skill-core,hub,ui}`，根级 tsconfig/eslint/prettier/vitest 基座与统一脚本（dev/build/lint/test/typecheck）
- [x] 1.3 配置 GitHub Actions CI：PR 触发 lint + typecheck + vitest + web build（Playwright 后续任务接入）
- [x] 1.4 引入 changesets 版本管理与发布流程骨架

## 2. 共享包：契约与技能核心

- [x] 2.1 `packages/contract`：用 zod 定义全量 API schema（认证/技能/互动/热度/推送/评论/合辑/关注/管理），导出推断类型
- [x] 2.2 `packages/skill-core`：SKILL.md frontmatter 解析、ZIP 安全校验（路径穿越/大小限制，纯 Node 解压）、文本文件抽取（语言映射/sha256）
- [x] 2.3 `packages/skill-core`：S/A/B/C 评级器与改进建议，移植现有 Python 测试用例为表驱动测试锁定行为一致
- [x] 2.4 `packages/api-client`：基于 contract 的类型安全 HTTP client（token/guest-session 注入、错误规范化）与 SSE client（自动重连、订阅者模式）

## 3. 服务端（apps/server）

- [x] 3.1 Fastify 应用骨架：配置加载（环境变量对齐现有 `.env` 键名）、zod type provider、OpenAPI 文档、CORS、健康检查 `/api/health`
- [x] 3.2 Drizzle 接管数据库：`drizzle-kit pull` 生成 baseline（与 Alembic head 等价，schema diff 核对），对既有库 stamp 不执行；新增 `skill_views`/`collections`/`collection_skills`/`user_follows` 迁移；清理 `git_path`/`git_commit_sha` 遗留字段迁移（含 down）
- [x] 3.3 认证模块：注册（随机密码邮件下发、ADMIN_EMAIL 自动 admin）、登录 JWT、`/me`、三档鉴权装置（必须/可选/admin）、游客会话认领
- [x] 3.4 设备码流程：init/poll/confirm，Redis 状态存储（key 结构与 TTL 对齐现有实现）
- [x] 3.5 技能读取：列表（search 含 skill_files 全文、category/tags/rating/origin/author 过滤、热度/时间排序、灰度门控、聚合单查询修复 N+1）、详情、文件树、单文件、版本历史
- [x] 3.6 技能写入：multipart 上传（skill-core 校验+评级）、MinIO 内容寻址存包、skill_files 入库、版本记录、他人同名拒绝、更新后 skill_update SSE 通知；ZIP 下载（MinIO 优先、skill_files 回退打包、下载记录）
- [x] 3.7 互动模块：copy（幂等）、like/unlike、ripple 前置校验与创建、stats 接口
- [x] 3.8 热度体系：heat_raw 聚合查询、周归一化（Redis 缓存基准每小时刷新）、热度榜接口、浏览计数端点（user/guest 按日去重）
- [x] 3.9 RP 推送：候选池构建（排除规则+30 分钟活跃游客）、随机 3–7 抽样、投递生命周期（pending/shown/consumed/dismissed）、guest touch/认领转换、consume/dismiss 端点
- [x] 3.10 SSE 模块：`/api/sse/notifications` 事件流、30s 心跳、连接补发 pending、Redis pub/sub 跨实例（不可用时本地降级）
- [x] 3.11 评论模块：嵌套树读取与发布
- [x] 3.12 合辑与关注：合辑 CRUD（admin）与列表/详情、关注/取关、关注信息流
- [x] 3.13 个人中心与画像：资料更新、likes/downloads/ripples 列表、LLM 画像生成（OpenAI + 静态模板降级）
- [x] 3.14 管理后台接口：用户/技能管理、总览统计、Top10 榜单
- [x] 3.15 API 集成测试：对照现有行为的端到端用例（认证、上传下载、互动前置、推送投递、灰度、SSE），覆盖 spec 全部 Scenario

## 4. 共享 UI 与 Web（apps/web）

- [x] 4.1 `packages/ui`：设计 token（橄榄绿色板/字体/圆角阴影）、基础组件（按钮/chip/卡片/弹窗/toast/头像/开关）、涟漪 Logo
- [x] 4.2 Next.js 骨架：App Router 布局、Header/Footer、API base 环境变量化（移除 localhost 硬编码 rewrite）、认证与游客 session 接入 api-client
- [x] 4.3 首页：Hero（水波 canvas 动画：雨滴/毛细波/重力波/鼠标交互、卸载清理）、信息流（四 tab 排序、卡片全要素、复制安装命令、加载更多、空态、筛选说明条）
- [x] 4.4 搜索浮层（⌘K、live 结果、Enter 应用、ESC 关闭）与右栏（热度榜 Top5、分类 chips、社区寄语卡）
- [x] 4.5 详情页：面包屑/标题/作者、安装条（复制/ZIP/安装）、统计条（含传播收藏操作）、Markdown 章节渲染、文件树浏览器（md 渲染+代码高亮+复制源码）、TOC 滚动定位、版本卡与历史展开、浏览计数上报
- [x] 4.6 评论区：嵌套展示、发布/回复、相对时间
- [x] 4.7 预览弹窗（热度分解条形图）与合辑页（卡片网格、展开清单、装齐整套）
- [x] 4.8 个人中心：资料卡与统计、我发布的/我收藏的 tabs、资料编辑与 AI 画像生成
- [x] 4.9 文档站四篇：生态概览/CLI/桌面客户端/Skill 规范（内容对齐原型文档页）
- [x] 4.10 实时通知：SSE 接入、ripple 吐司与揭示弹窗（consume）、skill_update 提示、游客 touch
- [x] 4.11 安装入口 Deep Link：`ripple://install` 唤起 + 失败回退复制命令
- [x] 4.12 管理后台页面迁移：总览/技能表/用户表（admin 门控）
- [x] 4.13 Playwright e2e：迁移现有 5 个视觉 spec 到新 UI，新增业务流用例（搜索→详情→复制、登录→点赞→ripple、上传）并接入 CI

## 5. 本地技能核心（packages/hub）

- [x] 5.1 状态层：state.json 原子读写、SSOT 目录管理、损坏时目录扫描重建
- [x] 5.2 分发层：symlink/junction/copy 三级策略与降级记录、启用/禁用/卸载、分发方式切换重建
- [x] 5.3 Agent 适配器注册表（Claude Code/Codex/OpenCode/Cursor 等 + detect）、项目目录管理、扫描（unmanaged 识别、版本冲突检测）
- [x] 5.4 安装与同步：多目标同步语义（勾选集合收敛）、版本统一、默认 Agent 逻辑
- [x] 5.5 备份与历史：操作前自动 zip 快照、20 份 FIFO 保留、恢复/删除、操作时间线与任意版本回退
- [x] 5.6 来源层：Ripple 服务（api-client）、GitHub tarball（分支/子目录扫描 SKILL.md）、本地 ZIP 导入；来源仓库增删
- [x] 5.7 存储位置切换平滑迁移（内置 ↔ 共享目录）
- [x] 5.8 hub 单元测试：三平台路径语义（含 Windows junction/copy 降级）、备份保留、同步收敛、来源安装

## 6. CLI（apps/cli）

- [x] 6.1 CLI 骨架：commander 分组命令 + 顶层捷径、全局 `--json`/`--yes`/`--server`/`--token`、退出码约定、非 TTY 降级、tsup 单文件构建与版本注入
- [x] 6.2 配置分层：参数 > 环境变量 > `~/.ripplerc` > 默认值，`config get|set`（含来源显示）
- [x] 6.3 认证命令：login（设备码，本机开浏览器/`--remote` 打印码）、logout、whoami
- [x] 6.4 服务侧命令：search/info/list/publish（纯 Node 打包、评级建议展示、`--channel gray`）
- [x] 6.5 本地命令：install/update(--all)/uninstall/sync/enable/disable、agent list|scan、source、backup（全部走 hub）
- [x] 6.6 self-update（npm 版本对比提示）与旧命令迁移对照文档 + 兼容别名
- [x] 6.7 CLI 集成测试：JSON 输出契约、退出码、非交互破坏操作拒绝、配置优先级

## 7. 桌面客户端（apps/desktop）

- [x] 7.1 Electron 骨架：electron-vite + React、主进程集成 hub、类型化 IPC contract、1280×820 窗口与主题
- [x] 7.2 侧边栏：连接状态卡、主导航（锁标/徽标）、Agent 列表（检测圆点+计数）、项目目录（添加/移除）、重新扫描、设置入口、状态栏
- [x] 7.3 本地技能列表：范围 chips、搜索、冲突横幅与一键统一、技能行（徽章/安装矩阵 chips/多版本显示）、展开逐处管理（更新/开关/卸载）
- [x] 7.4 同步弹窗与历史弹窗（时间线+回退）
- [x] 7.5 技能市场：浏览网格/排行榜/合集三视图、安装走同步弹窗、登录门控页
- [x] 7.6 更新中心：可更新列表、逐项更新、全部更新、空态、导航徽标
- [x] 7.7 设置：技能来源 tab（存储位置/分发方式/仓库管理/ZIP 导入/Deep Link 复制）与备份管理 tab
- [x] 7.8 登录/服务配置弹窗（服务地址、登录/保存/退出、token 安全存储）
- [x] 7.9 Deep Link：`ripple://` 协议注册（三平台）、install 参数解析进入安装流程、单实例聚焦
- [x] 7.10 electron-updater 自动更新（GitHub Release provider）
- [x] 7.11 桌面冒烟测试（主流程：扫描→安装→同步→回退）三平台手动验证清单 + 可自动化部分接入 CI

## 8. 发布与切换收尾

- [x] 8.1 npm 包名使用 `ripple`（`npm 包名定为 @hellosz/ripple（ripple 被 trueadm 的框架占用）），配置 NPM_TOKEN，`release-cli.yml` tag 发布流水线，首发 CLI
- [x] 8.2 `release-desktop.yml` 三平台矩阵构建上传 GitHub Release（含 electron-updater 元数据），首发桌面客户端
- [x] 8.3 服务端部署切换：新 server 指向既有 PostgreSQL/Redis/MinIO（baseline stamp），前端切换至新 API，双栈过渡验证后下线 Python 服务
- [x] 8.4 `/api/cli/version` 改为返回 npm 版本信息；退役 `backend/static/cli/ripple-cli.tgz`
- [x] 8.5 删除旧 `backend/`、`frontend/`、`cli/` 目录，更新 README/AGENTS.md/docker-compose 与开发文档到新布局
- [ ] 8.6 全量回归：spec Scenario 核对清单过一遍，e2e 绿灯，归档前审计
