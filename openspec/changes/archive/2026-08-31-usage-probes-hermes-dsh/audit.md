# Audit: usage-probes-hermes-dsh

## Before This Change

- 使用采集只覆盖 claude-code/opencode/codex；Hermes 与 DeepSeek Harness 的技能使用不可见。
- 首期调研将 Hermes 判为"仅弱信号"（prompt 注入不可辨认使用）。

## Gaps Identified

- 复核本机数据推翻弱信号结论：Hermes 有专用 `skill_view` 工具（tool 行含 timestamp/tool_call_id/技能名）——结构化 tool-call 证据；session_meta 的工具清单会匹配到 `skill_view` 字符串，解析必须排除 meta 行。
- DSH 会话为逐帧追加的多帧 zstd：Node `zstdDecompressSync` 与流式 `createZstdDecompress` 实测均只解首帧 → frame magic 分割 + 伪 magic 失败合并重试；`zstdDecompressSync` 需 Node ≥ 22.15 → available() 探测，CLI 旧运行时自动跳过。
- 压缩文件无法字节续读 → size+mtime 游标、变更即整扫（id 幂等保证不重复计数）。

## Implemented Contract

- `probe-hermes.ts`：`~/.hermes/sessions/*.jsonl` 字节游标增量，`role=tool ∧ name=skill_view ∧ success≠false` → tool-call 事件（id=tool_call_id，时间=行 timestamp）；meta/失败/其他工具不计。
- `probe-dsh.ts`：`~/.dsh/sessions/*/session-*/session.jsonl.zstd` 多帧解压（`inflateZstdFrames` 导出可测）、SKILL.md 路径启发式 + SSOT 白名单、会话首行 cwd/createdAt 关联、行 time 毫秒戳、未变更跳过。
- `defaultProbes()` 注册两条目；设置按 Agent 开关与证据标注（deepseek-harness=路径启发）扩展。
- 测试：hub 79 测全绿（新增 5：skill_view 识别/增量幂等、zstd 多帧、白名单+cwd/time+未变更跳过、available 探测）。真实数据冒烟：Hermes 106 会话提取 72 次使用（20 个技能）；DSH 唯一真实痕迹因不在 SSOT 被白名单正确过滤（事件抽取验证通过）。
