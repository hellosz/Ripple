# desktop-client（delta）

## ADDED Requirements

### Requirement: placement 双态标识
技能行的 Agent 矩阵 MUST 不使用「专」字：通用（共享目录标准引入）与专属（agent 私有目录分发）用不同记号/背景色区分，且同一 Agent 同时存在两种 placement 时 MUST 同时可见；悬浮说明分发方式（.agents 共享 / .codex 等私有目录）。

#### Scenario: 双态同时呈现
- **WHEN** 某技能对 Codex 既有共享引入又有专属副本
- **THEN** 矩阵中该 Agent 徽标同时呈现两种状态记号

### Requirement: 社区开源折叠与只读预览
社区开源视图 MUST 支持按仓库折叠/展开；点击技能行 MUST 打开只读预览（文件树 + 内容渲染），不提供编辑。

#### Scenario: 预览远端技能
- **WHEN** 用户点击社区技能行
- **THEN** 弹出只读预览（无「编辑」入口）

### Requirement: Skill 查看器渲染与素材预览
本地/市场/社区的 Skill 查看器 MUST：预览模式渲染 Markdown 样式（标题/列表/代码块/表格），编辑模式显示原文；图片等本地素材 MUST 可预览（通用素材预览：图片内联显示，其他二进制显示类型与大小）。

#### Scenario: Markdown 预览
- **WHEN** 用户查看 SKILL.md（未进入编辑）
- **THEN** 内容以渲染样式呈现；点击「编辑」切换为原始 Markdown

#### Scenario: 图片素材预览
- **WHEN** 技能包含 assets/logo.png 且用户在文件树点击它
- **THEN** 内联显示图片而非提示不可读

### Requirement: 卸载入口
桌面 MUST 支持两种卸载：整技能卸载（移除全部安装位置，SSOT 所有权内内容随最后一处移除）与指定 Agent 下卸载（仅该 placement）；均需确认并提示自动备份。

#### Scenario: 卸载单个 placement
- **WHEN** 用户对某技能选择"从 Codex 卸载"
- **THEN** 仅 Codex 的 placement 移除，其他 Agent 不受影响

### Requirement: 界面细节修正
`github.com` URL 添加的仓库 label MUST 不带 host 前缀且不标 GitLab；设置入口的"来源 · 备份 · 记录"小字说明 MUST 移除；社区来源分组标题异常修正。

#### Scenario: GitHub URL 来源显示
- **WHEN** 用户以 `https://github.com/owner/repo` 添加来源
- **THEN** 列表显示 `owner/repo` 与 GitHub 徽标
