# cli-tool

## ADDED Requirements

### Requirement: 命令结构与规范
CLI SHALL 以 `ripple` 为命令名（npm 包名 `ripple`，Node ≥ 20，单文件产物），采用「名词 + 动词」分组命令（`ripple agent list`、`ripple source add`、`ripple backup restore`），高频操作保留顶层动词捷径（`login/search/info/install/update/uninstall/publish/list/sync/enable/disable`）。所有命令 MUST 提供 `--help`；未知命令/参数错误 MUST 以退出码 2 结束并提示用法。退出码约定：0 成功、1 业务失败、2 参数错误。

#### Scenario: 未知参数
- **WHEN** 执行 `ripple install --no-such-flag`
- **THEN** 打印用法提示到 stderr 并以退出码 2 退出

### Requirement: 机器可读输出与脚本化
所有查询与操作命令 MUST 支持全局 `--json`，输出稳定结构的 JSON 到 stdout（人类可读文本与进度信息只走 stderr 或非 JSON 模式）。非 TTY 环境 MUST 自动禁用彩色与交互式提问；破坏性操作（卸载、删除备份、覆盖）在非交互模式下 MUST 要求 `--yes`，否则以退出码 1 拒绝。

#### Scenario: CI 中的 JSON 输出
- **WHEN** 在管道中执行 `ripple list --json`
- **THEN** stdout 是可被 jq 解析的 JSON 数组，无彩色控制字符

#### Scenario: 非交互卸载缺少确认
- **WHEN** CI 中执行 `ripple uninstall foo`（无 --yes）
- **THEN** 命令拒绝执行并以退出码 1 结束

### Requirement: 认证命令
CLI SHALL 提供 `ripple login`（设备码流程：本机模式自动打开浏览器，`--remote` 模式打印验证链接与 user_code；轮询成功后 token 以 0600 权限存入配置文件）、`ripple logout`、`ripple whoami`。

#### Scenario: 远程模式登录
- **WHEN** 用户在无浏览器的服务器上执行 `ripple login --remote`
- **THEN** 打印验证 URL 与格式为 XXXX-XXXX 的验证码，用户在别处确认后 CLI 轮询成功并保存 token

### Requirement: 发现与安装
CLI SHALL 提供 `ripple search <query>`、`ripple info <name>`（显示描述/评级/版本/热度/安装命令）、`ripple list`（远端列表；`--installed` 列本地安装矩阵）、`ripple install <name>`（经 hub 安装到 SSOT 并分发；`--agent <id>` 指定目标 Agent，缺省安装到默认 Agent；`--project <dir>` 项目作用域；`--version` 指定版本）。安装 MUST 复用 local-skill-hub 语义（校验、备份、symlink/copy）。

#### Scenario: 指定 Agent 安装
- **WHEN** 执行 `ripple install git-archaeologist --agent claude-code`
- **THEN** 技能进入 SSOT 并分发到 `~/.claude/skills/git-archaeologist`

### Requirement: 更新、卸载与多目标同步
CLI SHALL 提供 `ripple update [<name>]`（更新指定技能全部安装）与 `ripple update --all`（更新所有落后安装，适合 CI 定时保持一致）、`ripple uninstall <name> [--agent <id>] [--project <dir>]`、`ripple sync <name> --to <agent[:project]>...`（收敛安装矩阵）、`ripple enable|disable <name> --agent <id> [--project <dir>]`。更新/同步/卸载前 MUST 自动备份。

#### Scenario: CI 保持团队技能一致
- **WHEN** 流水线执行 `ripple update --all --json`
- **THEN** 所有落后安装被更新，输出 JSON 包含每处安装的 from/to 版本

### Requirement: 发布
CLI SHALL 提供 `ripple publish <path>`：目录自动打包（纯 Node zip）或直接接受 zip 文件，携带 `--category/--recommendation/--origin/--tags/--channel`（gray 走灰度）上传；成功后展示评级与改进建议。发布权限不足时 MUST 明确报错。

#### Scenario: 发布并查看评级
- **WHEN** 管理员执行 `ripple publish ./my-skill --recommendation "..." --category 工具链`
- **THEN** 输出评级（如 A）与达到 S 的改进建议列表

### Requirement: 来源与备份管理
CLI SHALL 提供 `ripple source list|add <owner/repo>[#branch][:subdir]|remove <id>`（GitHub 仓库来源，未登录可用）与 `ripple backup list|restore <id>|prune`，语义与 local-skill-hub 一致。

#### Scenario: 从 GitHub 来源安装
- **WHEN** 执行 `ripple source add anthropics/skills` 后 `ripple install <其中技能名>`
- **THEN** 未登录状态下安装成功

### Requirement: Agent 与扫描
CLI SHALL 提供 `ripple agent list`（各 Agent 检测状态、路径与安装数）与 `ripple agent scan`（重新扫描本地目录，输出发现的 unmanaged 技能与版本冲突）。

#### Scenario: 查看安装矩阵
- **WHEN** 执行 `ripple agent list --json`
- **THEN** 输出每个 Agent 的 id、检测状态、全局路径与安装数量

### Requirement: 配置分层
CLI 配置 MUST 按优先级合并：命令行参数（`--server/--token` 等）> 环境变量（`RIPPLE_SERVER`、`RIPPLE_TOKEN`）> 用户配置文件（`~/.ripplerc`）> 默认值。`ripple config get|set <key> [value]` 读写用户配置文件；`ripple config get` 输出生效配置及其来源。

#### Scenario: 环境变量覆盖配置文件
- **WHEN** `~/.ripplerc` 配置了 server A 且环境变量 RIPPLE_SERVER=B
- **THEN** 请求发往 B，`ripple config get server` 显示值 B 与来源 env

### Requirement: 自更新提示
CLI SHALL 提供 `ripple self-update`：对比 npm registry 上的最新版本（经服务端 `/api/cli/version` 或直接查 registry），提示 `npm i -g ripple@latest` 升级方式；`ripple --version` 输出的版本 MUST 与包版本单一来源一致（构建时注入）。

#### Scenario: 版本一致性
- **WHEN** 执行 `ripple --version`
- **THEN** 输出与已发布 npm 包 version 字段完全一致

### Requirement: 旧命令迁移对照
CLI 文档 MUST 提供旧版命令（v0.x：`ripple install --target claude` 等）到新命令面的迁移对照表；旧版高频命令若语义未变则保留别名兼容。

#### Scenario: 旧别名仍可用
- **WHEN** 用户执行旧别名 `ripple i <name>`
- **THEN** 等价于 `ripple install <name>` 正常工作
