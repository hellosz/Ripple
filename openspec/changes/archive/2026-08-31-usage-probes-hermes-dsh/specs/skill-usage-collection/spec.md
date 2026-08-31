# skill-usage-collection

## ADDED Requirements

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
