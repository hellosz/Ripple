# Proposal: ripple-ts-rewrite

## Why

Ripple 目前是 Python(FastAPI) + TypeScript(Next.js) 双栈，仅有 Web 端与一个零依赖的极简 CLI，没有桌面客户端，本地技能管理（多 Agent 目录、版本一致性、备份回退）完全缺失。新的产品设计原型（Claude Design 项目「内容社区主题重构方案」中的《Ripple 首页 · 交互原型》与《Ripple 桌面客户端 · 原型》）定义了全新的三端产品形态：Web 社区、跨平台桌面客户端（Linux/macOS/Windows）、与桌面能力对齐的 CLI。统一为 TypeScript 全栈可以让三端共享类型契约与本地技能管理核心库，一套领域逻辑服务所有入口；同时项目将从内部 GitLab 迁移到 GitHub（项目名 Ripple），CLI 与桌面客户端通过 npm registry 和 GitHub Release 公开分发——这些都要求一次完整的重构。

## What Changes

- **BREAKING** 后端由 FastAPI/Python 重写为 TypeScript 服务端（Node），保留并延续现有全部 API 能力：邮箱注册/JWT 登录、OAuth 设备码流程、技能上传校验与 S/A/B/C 自动评级、技能列表/详情/文件树/版本/ZIP 下载、copy/like/download/ripple 互动、RP 随机推送与游客会话认领、SSE 实时通知（Redis pub/sub 跨实例）、嵌套评论、管理后台、灰度发布（publish_channel）、MinIO 对象存储 + skill_files 全文搜索。数据库 schema 保持兼容（PostgreSQL，Alembic 迁移史由新迁移工具接管）。
- **BREAKING** Web 前端按新原型重构：新首页（Hero 水波动画、推荐/最热/最新/关注信息流、热度榜、分类筛选、⌘K 搜索浮层）、技能详情页（安装条、热度统计条、文件树预览、TOC、版本历史、评论）、合辑（Collections）页、文档站（生态概览/CLI/桌面客户端/Skill 规范）、个人中心，视觉体系切换为原型的橄榄绿色板与 Noto Sans SC/Space Grotesk 字体。
- **新增热度体系**：热度 = 传播×1 + 收藏×2 + 评论×4 + 查询×0.05，按周归一化；驱动信息流排序、热度榜与详情页统计（现有 stats/size_tier 演进为该模型）。
- **新增桌面客户端**（Linux/macOS/Windows，通用前端栈：Electron + React，与 Web 共享 UI 组件与类型）：本地技能列表（全部/仅全局/仅项目）、Agent 侧边栏与项目目录管理、安装矩阵与展开式逐处管理（启用/禁用/更新/卸载）、版本不一致检测与一键统一、同步弹窗、历史记录与回退、技能市场（浏览/排行榜/合集）、更新中心与全部更新、设置（中心存储位置、symlink/复制分发、GitHub 仓库源、ZIP 导入、Deep Link `ripple://`）、备份管理器、登录/本地模式门控。
- **BREAKING** CLI 重写为 `ripple`（npm 包名 `@hellosz/ripple`（`ripple` 已被占用））：能力对齐桌面客户端（服务侧 + 本地技能管理），命令设计遵循现代 CLI 规范（参考 lark-cli：名词+动词分组命令、`--json` 机器可读输出、非交互模式、明确退出码），零/低依赖纯 Node 实现（移除对外部 `zip`/`unzip` 的依赖）。
- **新增共享本地技能管理核心库**（桌面客户端与 CLI 共用）：SSOT 中心存储（`~/.ripple/skills` 或共享 `~/.agents/skills`，可平滑迁移）、symlink/文件复制两种分发方式、多 Agent 适配器（Claude Code、Codex、OpenCode 等，可扩展）、项目级目录、操作前自动备份（保留最近 20 份）与任意版本回退、多来源安装（Ripple 服务、GitHub 仓库[分支+子目录]、ZIP 离线导入，后两者无需登录）。
- **仓库迁移与分发**：git 迁移到 GitHub（项目名 Ripple）；monorepo 重组为 pnpm workspace（server / web / desktop / cli / 共享 packages）；CLI 经 npm registry 发布，桌面客户端经 GitHub Release 分发（三平台安装包），CI 由 GitHub Actions 承担。

## Capabilities

### New Capabilities

- `server-api`: TypeScript 服务端的完整 API 契约——认证（注册/登录/设备码）、技能注册表（上传校验、评级、版本、文件、下载）、互动与热度计算、RP 推送与 SSE 通知、评论、合辑、管理后台、灰度发布。
- `web-community`: Web 社区体验——首页信息流与热度榜、搜索、技能详情、合辑、文档站、个人中心、涟漪视觉体系。
- `skill-package-spec`: 技能包规范——SKILL.md frontmatter 契约、目录结构（references/scripts/assets）、校验规则与 S/A/B/C 自动评级。
- `local-skill-hub`: 本地技能管理核心（桌面与 CLI 共享）——SSOT 中心存储、symlink/复制分发、Agent 适配器、项目目录、扫描、版本一致性、备份与回退、多来源安装。
- `desktop-client`: 跨平台桌面客户端——本地管理界面、技能市场、更新中心、同步/历史/备份 UI、设置、Deep Link、登录/本地模式。
- `cli-tool`: `ripple` 命令行——服务侧命令（登录/搜索/安装/发布/更新）与本地管理命令（agent/来源/备份），CLI 规范（JSON 输出、退出码、脚本化）。
- `distribution`: 仓库迁移与分发——GitHub 迁移、monorepo 布局、npm 发布 CLI、GitHub Release 发布桌面客户端、CI/CD 与版本策略。

### Modified Capabilities

（无——`openspec/specs/` 目前为空，所有能力均为新建。历史 change `enhance-skill-engagement-and-comments` 与 `migrate-skill-storage-to-minio` 中的 spec 文件作为现有行为契约的事实参考，其要求被吸收进上述新 spec。）

## Impact

- **代码**：`backend/`（Python）整体被 TS 服务端取代；`frontend/` 按新原型重构；`cli/` 重写；新增桌面客户端应用与共享 packages（类型契约、API client、本地技能核心、UI 组件）。仓库重组为完整 pnpm monorepo。
- **数据**：PostgreSQL schema 延续（users/skills/skill_versions/skill_files/互动表/ripples/评论等），迁移历史由 TS 迁移工具接管；清理遗留死字段（`git_path`、`git_commit_sha`）；MinIO、Redis 继续使用。
- **API**：端点语义保持兼容并扩展（热度、合辑、关注流）；现有已知缺口（tags 过滤未实现、N+1 查询、下载端点类型不符等）在重写中修复。
- **基础设施**：git remote 从 `gitlab.interfocus.tech:fabulous/ripple` 迁移到 GitHub；CI 从无到 GitHub Actions；分发渠道 npm registry（CLI）+ GitHub Release（桌面三平台安装包）取代 `backend/static/cli/ripple-cli.tgz` 自托管。
- **用户**：Web 用户界面全面更新；CLI 用户命令面变化（**BREAKING**，提供迁移对照）；桌面客户端为全新入口；`ripple://` Deep Link 打通 Web → 桌面安装。
