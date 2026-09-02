# local-skill-hub

## ADDED Requirements

### Requirement: 共享目录始终识别

hub SHALL 无条件识别 `~/.agents/skills` 中含 SKILL.md 的技能目录（与存储位置配置无关）；技能目录解析 SHALL 按「自有 SSOT 根优先、共享目录回退」顺序，两处同名时以 SSOT 为准。存储位置配置 MUST 只决定 Ripple 自装技能的落点，不影响识别范围。

#### Scenario: 内置存储下识别社区安装的技能

- **WHEN** 存储位置为「内置」且第三方工具在 `~/.agents/skills/ask-matt` 安装了含 SKILL.md 的技能
- **THEN** 技能枚举包含 ask-matt，且 readSkillFiles/场景分析等按共享目录路径解析成功

### Requirement: 共享落点与 SSOT 解耦

技能实际位于共享目录时，支持共享标准的 Agent 的全局落点 SHALL 为零分发（shared placement，现状保持）；技能位于内置 SSOT 时执行共享落点 SHALL 在 `~/.agents/skills/<name>` 创建指向 SSOT 的 symlink（失败降级 copy 并明示）。移除共享落点（该技能最后一个 shared 记录被移除）时 MUST 仅删除"确认指向我方 SSOT 的链接"；`~/.agents/skills` 中的真实目录与第三方内容 MUST NOT 被删除或覆盖。

#### Scenario: 内置 SSOT 技能共享后可被共享型 Agent 使用

- **WHEN** 存储位置为「内置」、技能 foo 在 `~/.ripple/skills/foo`，用户对 foo 执行「共享」到支持共享标准的 Agent
- **THEN** `~/.agents/skills/foo` 成为指向 `~/.ripple/skills/foo` 的 symlink，安装记录 mode=shared；移除全部共享落点后该 symlink 被删除，而共享目录中其他第三方目录不受影响

#### Scenario: 不覆盖共享目录中的既有内容

- **WHEN** `~/.agents/skills/foo` 已存在（第三方安装的真实目录），用户对内置 SSOT 的同名技能执行共享
- **THEN** 操作失败并明示冲突（或按解析规则以既有内容为准），既有目录内容不被修改
