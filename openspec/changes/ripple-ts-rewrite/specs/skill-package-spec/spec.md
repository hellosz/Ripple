# skill-package-spec

## ADDED Requirements

### Requirement: 技能包目录结构
技能包 SHALL 是一个包含 `SKILL.md` 的目录（或其 ZIP 归档）。约定子目录：`references/`（按需加载的详细文档）、`scripts/`（可执行脚本）、`assets/`（模板与静态资源）；子目录均为可选。校验器 MUST 拒绝缺少 `SKILL.md` 的包。

#### Scenario: 缺少 SKILL.md
- **WHEN** 上传的 ZIP 内不存在 SKILL.md
- **THEN** 校验失败并报"缺少 SKILL.md"

### Requirement: SKILL.md frontmatter 契约
`SKILL.md` MUST 以 YAML frontmatter 开头且包含 `name`（全局唯一安装名，kebab-case）与 `description`；可选字段：`version`（缺省 1.0.0）、`display_name`、`category`、`tags`。frontmatter 缺失必填字段时校验 MUST 失败并指明字段。

#### Scenario: 缺少 description
- **WHEN** SKILL.md frontmatter 只有 name
- **THEN** 校验失败并提示缺少 description

#### Scenario: 版本缺省
- **WHEN** frontmatter 未声明 version
- **THEN** 解析结果 version 为 1.0.0

### Requirement: ZIP 安全校验
校验器 MUST 验证归档为合法 ZIP、拒绝绝对路径与包含 `..` 的路径穿越条目，并强制大小上限（服务端上传 ≤10MB）。该校验逻辑 SHALL 由 server、desktop、cli 共享同一实现（skill-core 包）。

#### Scenario: 路径穿越条目
- **WHEN** ZIP 内含 `../../etc/passwd` 条目
- **THEN** 校验失败，任何文件都不落盘

### Requirement: 自动评级 S/A/B/C
系统 SHALL 依据规则对技能自动评级：检测 Workflow/Architecture 标题、Decision/Rule 标题、Quality 标题、代码块（输出模板）、h2 数量、description 长度与 `agents/` 目录。判级规则：S（夯）= workflow + agents/ + decision rules + description≥50 字 + 代码块；A（稳）= workflow + description≥30 + h2≥3；B（行）= h2≥2 + description≥20；否则 C（拉）。评级结果 MUST 与现有 Python 实现在同一输入下一致（以移植的表驱动测试锁定）。

#### Scenario: 满足 S 级条件
- **WHEN** 技能包含 Workflow 章节、agents/ 目录、Decision 规则、50 字以上描述与代码块
- **THEN** 评级为 S

#### Scenario: 仅基本结构
- **WHEN** 技能只有 2 个 h2 与 20 字描述
- **THEN** 评级为 B

### Requirement: 评级改进建议
对非 S 级技能，评级器 MUST 返回改进建议列表（指出缺失的加分项），供 Web 上传表单、CLI publish 与桌面端展示。

#### Scenario: publish 展示建议
- **WHEN** 用户发布评级为 B 的技能
- **THEN** 响应包含使其达到 A/S 所缺项的建议列表

### Requirement: 文本文件抽取
入库时系统 SHALL 遍历包内文本文件（跳过隐藏文件与二进制扩展名），记录路径、内容、语言标记、大小与 sha256，作为文件浏览与全文搜索的数据源。

#### Scenario: 二进制文件不入全文库
- **WHEN** 包内含 PNG 图片
- **THEN** 该文件不写入文本文件表，但保留在原包 ZIP 中
