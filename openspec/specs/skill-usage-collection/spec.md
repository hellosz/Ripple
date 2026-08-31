# skill-usage-collection Specification

## Purpose
TBD - created by archiving change skill-usage-insights. Update Purpose after archive.
## Requirements
### Requirement: Usage probe 注册表

hub SHALL 以声明式注册表维护各 Agent 的 usage probe（id 对齐 AGENT_ADAPTERS），每个 probe 声明证据源位置与解析器；新增 Agent 的使用采集 MUST 只通过新增注册表条目扩展，不改采集内核。probe 解析失败 MUST 静默跳过该证据源并继续，不得阻塞其他 probe 或主流程。

#### Scenario: probe 不可用时跳过

- **WHEN** opencode probe 所需的 `node:sqlite` 在当前运行时不可用（如 CLI Node 20）
- **THEN** 该 probe 标记为不可用被跳过，其余 probe 正常采集，结果中不包含 opencode 事件

### Requirement: 结构化证据解析（claude-code / opencode）

claude-code probe SHALL 流式逐行解析 `~/.claude/projects/**/*.jsonl`，将 assistant 消息中 `tool_use` 且 `name === 'Skill'` 的调用识别为使用事件（skill 取 `input.skill`，项目取会话 `cwd`，时间取行 `timestamp`），证据等级为 `tool-call`。opencode probe SHALL 以只读方式查询 `opencode.db` 中 `tool === 'skill'` 的 part 记录并关联 session 的 directory/时间，证据等级为 `tool-call`。

#### Scenario: 解析 Claude Code 的 Skill 调用

- **WHEN** 某会话 jsonl 中存在 `{"type":"tool_use","name":"Skill","input":{"skill":"opsx-propose"}}` 的 assistant 行
- **THEN** 产出一条事件：skill=opsx-propose、agent=claude-code、evidence=tool-call、project_dir=该会话 cwd、occurred_at=该行 timestamp

### Requirement: 启发式证据解析（codex）

codex probe SHALL 解析 `~/.codex/sessions/**/rollout-*.jsonl` 的工具调用参数，匹配读取 `skills/<name>/SKILL.md` 路径的命令识别为使用事件，证据等级为 `path-heuristic`；技能名 MUST 与 hub SSOT 中存在的技能名比对，未知名称丢弃。

#### Scenario: 识别 Codex 读取 SKILL.md

- **WHEN** rollout jsonl 中出现 `{"cmd":"sed -n '1,240p' /home/u/.agents/skills/openspec-explore/SKILL.md"}` 的工具调用且本地存在技能 openspec-explore
- **THEN** 产出 skill=openspec-explore、agent=codex、evidence=path-heuristic 的事件

### Requirement: 事件存储与幂等

使用事件 SHALL 以 JSONL 分月分片持久化在 `~/.ripple/usage/events-YYYY-MM.jsonl`，事件 id 由 `agent + session + 调用标识（toolCallId/行 uuid/行号）` 哈希生成；重复扫描同一证据源 MUST NOT 产生重复事件。聚合统计（按 skill × agent × 项目的次数、首次/最近时间）SHALL 缓存于 `stats.json`，损坏或缺失时可由事件明细完整重建。

#### Scenario: 重复扫描幂等

- **WHEN** 对同一批 transcript 连续执行两次全量扫描
- **THEN** 事件总数与首次扫描一致，聚合统计不变

### Requirement: 增量游标

每个证据源 SHALL 维护游标（jsonl 记字节偏移与 size/mtime；SQLite 记时间/rowid 水位）；增量扫描 MUST 只解析游标之后的内容；检测到文件截断或替换（size 变小）时 MUST 从头重扫该源（幂等保证不重复计数）。单文件 MUST 流式逐行解析，禁止整读进内存。

#### Scenario: 追加内容增量解析

- **WHEN** 某 jsonl 上次扫描后追加了 3 条 Skill 调用，再次扫描
- **THEN** 仅解析新增字节，新增 3 条事件，游标推进到新文件末尾

### Requirement: 隐私边界

使用采集 SHALL 默认关闭，开启需用户显式操作（总开关 + 按 Agent 开关）；事件默认 MUST 只含元数据（skill/agent/时间/project_dir/session_id/evidence/来源文件路径），MUST NOT 存储对话正文或完整工具入参出参。SHALL 提供一键清除全部使用数据。

#### Scenario: 默认不采集

- **WHEN** 用户从未开启使用采集
- **THEN** 不读取任何 Agent 的 transcript 文件，`~/.ripple/usage/` 不产生事件数据

### Requirement: Hermes 结构化证据解析

hermes probe SHALL 流式增量解析 `~/.hermes/sessions/*.jsonl`，将 `role === 'tool'` 且 `name === 'skill_view'` 且结果成功的行识别为使用事件（技能名取 content JSON 的 `name`，时间取行 `timestamp`，调用标识取 `tool_call_id`），证据等级为 `tool-call`；session_meta 中的技能清单注入 MUST NOT 计为使用。

#### Scenario: 识别 skill_view 调用

- **WHEN** 会话 jsonl 中存在 `{"role":"tool","name":"skill_view","tool_call_id":"call_x","timestamp":"2026-05-12T13:20:00","content":"{\"success\":true,\"name\":\"trace-id-diagnosis\"}"}` 行
- **THEN** 产出 skill=trace-id-diagnosis、agent=hermes、evidence=tool-call、occurred_at=行 timestamp 的事件，且重复扫描不重复计数

### Requirement: DeepSeek Harness 启发式证据解析

deepseek-harness probe SHALL 解析 `~/.dsh/sessions/*/session-*/session.jsonl.zstd`：多帧 zstd 按 frame magic 分割解压（分割失败的候选帧向后合并重试）；事件行中匹配 `skills/<name>/SKILL.md` 路径且技能名存在于 hub SSOT 的记为使用事件（evidence=path-heuristic，occurred_at 取行 `time` 毫秒戳，project_dir 取会话首行 `cwd`）。运行时缺少 zstd 解压能力（Node < 22.15）时 probe MUST 标记不可用并跳过。压缩文件游标为 size+mtime，变更即整文件重扫且幂等不重复计数。

#### Scenario: 多帧解压与白名单

- **WHEN** 某 session.jsonl.zstd 为两个 zstd 帧拼接，内容含已知技能 foo 与未知名 bar 的 SKILL.md 路径
- **THEN** 全部帧被解压解析，仅产出 foo 的事件；文件未变更时再次扫描零新增

