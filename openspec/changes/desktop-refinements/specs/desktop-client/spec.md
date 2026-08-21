# desktop-client（delta）

## ADDED Requirements

### Requirement: 连接卡与登录态展示
侧边栏连接卡 MUST 使用品牌头图背景（打包内置的原型头图），文本不得溢出；已登录时 MUST 显示用户**昵称**（无昵称回退邮箱前缀）与服务主机名。

#### Scenario: 登录后显示昵称
- **WHEN** 用户以设置了昵称的账号登录
- **THEN** 连接卡显示"已登录 · <昵称>"，长文本省略号截断

### Requirement: Agent 列表排序与折叠
AGENT·全局列表 MUST 按固定顺序展示：Claude Code、Codex、OpenCode、Hermes、OpenClaw、Pi，其余靠后；有技能的 Agent 置顶，无技能的 Agent 收纳进可展开的折叠区。每个 Agent MUST 显示可识别的品牌 logo（无官方矢量资源时用品牌色字母块兜底）。

#### Scenario: 空 Agent 折叠
- **WHEN** Cursor 未安装任何技能
- **THEN** 它出现在"未使用"折叠区内，展开后可见

### Requirement: 技能行存在矩阵与补齐
本地技能行 MUST 去除展开/折叠交互，常显 Agent 存在矩阵：每个 Agent 一个 logo 徽标，状态区分 已装-通用（共享标准引入）/ 已装-专属 / 未装；点击未装徽标即补齐安装到该 Agent。操作按钮文案为「同步」（不截断），「历史」位于其后。

#### Scenario: 补齐到缺失 Agent
- **WHEN** 技能仅装于 Claude Code，用户点击矩阵中的 Hermes 徽标
- **THEN** 立即补齐并 toast 反馈，徽标变为已装态并标注 通用/专属

### Requirement: 来源浏览与 GitLab
设置-技能来源中每个仓库 MUST 提供「浏览技能」入口：列出仓库内技能（名称/版本/描述）并可选择目标安装；添加来源支持粘贴 GitHub `owner/repo` 或私服 GitLab public 仓库 URL。

#### Scenario: 从来源浏览安装
- **WHEN** 用户点击某来源的「浏览技能」并安装其中一个
- **THEN** 技能进入本地列表，安装来源记入操作记录

### Requirement: 操作记录入口
设置 MUST 新增「操作记录」tab，倒序展示 hub 操作日志（时间、动作、对象、影响摘要）。

#### Scenario: 查看操作记录
- **WHEN** 用户完成若干操作后打开 设置 → 操作记录
- **THEN** 可见对应条目

### Requirement: 按 Agent 批量备份 UI
设置-备份管理 MUST 支持勾选一个或多个 Agent（含全选）执行一键备份，完成后生成的备份记录出现在列表中可恢复。

#### Scenario: 多选备份
- **WHEN** 用户勾选 Claude Code 与 Codex 并点击备份
- **THEN** 两者安装的技能（去重）各生成备份记录并 toast 汇报数量
