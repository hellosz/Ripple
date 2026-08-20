# distribution

## ADDED Requirements

### Requirement: GitHub 仓库迁移
项目 git 仓库 MUST 迁移到 GitHub（项目名 Ripple），保留完整提交历史与分支/标签（`git push --mirror`），迁移后 origin 指向 GitHub；GitLab 远端保留为只读过渡（可选 `gitlab` remote 名）。

#### Scenario: 历史完整性
- **WHEN** 迁移完成后对比两端仓库
- **THEN** GitHub 上的 main 分支提交 SHA 与 GitLab 完全一致，标签齐全

### Requirement: Monorepo 布局
仓库 MUST 重组为 pnpm workspace monorepo：`apps/server`、`apps/web`、`apps/desktop`、`apps/cli` 与 `packages/contract`、`packages/api-client`、`packages/skill-core`、`packages/hub`、`packages/ui`；根提供统一脚本（dev/build/lint/test/typecheck）。切换完成前旧 `backend/`、`frontend/`、`cli/` 保留，切换完成后删除。

#### Scenario: 一键开发环境
- **WHEN** 开发者克隆仓库执行 `pnpm install && pnpm dev`
- **THEN** server 与 web 同时启动并可访问

### Requirement: 持续集成
GitHub Actions MUST 在 PR 与 main push 上执行：lint、typecheck、单元测试（vitest）、web 构建与关键流程 e2e（Playwright）。CI 失败的 PR 不允许合并。

#### Scenario: PR 校验
- **WHEN** 提交包含类型错误的 PR
- **THEN** typecheck job 失败，PR 显示红叉

### Requirement: CLI npm 发布
CLI MUST 通过 npm registry 发布（包含 bin `ripple`），由 `v*` tag 触发的 GitHub Actions workflow 执行构建与 `npm publish`（NPM_TOKEN secret）。包 MUST 内嵌单一来源版本号，发布产物为自包含单文件（不依赖仓库内其他包的运行时安装）。

#### Scenario: 打 tag 发布 CLI
- **WHEN** 推送 tag v1.0.0
- **THEN** CI 构建并发布 ripple@1.0.0，`npm i -g ripple` 后 `ripple --version` 输出 1.0.0

### Requirement: 桌面客户端 GitHub Release 发布
桌面客户端 MUST 经 GitHub Release 分发：tag 触发三平台矩阵构建（Linux AppImage+deb、macOS dmg、Windows nsis exe），产物与 electron-updater 元数据（latest*.yml）上传至对应 Release；已安装客户端可据此自动更新。

#### Scenario: Release 资产完整
- **WHEN** 桌面发布 workflow 完成
- **THEN** 对应 GitHub Release 含三平台安装包及自动更新元数据文件

### Requirement: 版本管理
monorepo MUST 使用统一的版本管理流程（changesets）：变更附带 changeset，合并后自动累积版本与 changelog，发布 tag 与各包版本对应。

#### Scenario: 版本与 changelog 生成
- **WHEN** 含 changeset 的 PR 合并并执行版本发布流程
- **THEN** 相关包版本号提升且 CHANGELOG 自动更新

### Requirement: 旧分发渠道退役
`backend/static/cli/ripple-cli.tgz` 自托管分发 MUST 退役；服务端 `/api/cli/version` 改为返回 npm 最新版本信息，旧 CLI 的 self-update 提示指向 npm 安装方式。

#### Scenario: 旧 CLI 收到迁移提示
- **WHEN** 旧版 CLI 执行 self-update 检查
- **THEN** 收到指向 `npm i -g ripple` 的升级指引
