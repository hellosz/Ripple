# Proposal: usage-probes-hermes-dsh

## Why

使用分析首期只覆盖 claude-code/opencode/codex；用户日常还重度使用 Hermes 与 DeepSeek Harness，这两家的技能使用完全不可见。本机复核（2026-08-31）发现证据比首期调研预估更好：Hermes 有专用 `skill_view` 工具调用（`~/.hermes/sessions/*.jsonl` 的 tool 行带 timestamp + tool_call_id + 技能名，本机 39 个会话 148 次，**结构化证据**）；DeepSeek Harness 会话（`~/.dsh/sessions/*/session-*/session.jsonl.zstd`）为多帧 zstd 压缩 JSONL，事件带 `time` 毫秒戳，SKILL.md 路径可启发式识别，首行含 cwd。

## What Changes

- 新增 hermes probe（结构化 tool-call 证据：`skill_view` 工具结果行）与 deepseek-harness probe（路径启发式 + SSOT 白名单），按既有 probe 注册表模式追加条目。
- DSH zstd 多帧解压：magic 分割 + 失败合并重试（实测 Node `zstdDecompressSync` 与流式均只解首帧）；`available()` 探测 `zlib.zstdDecompressSync`（Node ≥ 22.15），缺失则跳过。
- 压缩文件无法字节续读 → 游标记 size/mtime，变更即整文件重解压重扫（事件 id 幂等去重）。
- 桌面设置的按 Agent 开关与证据标注扩展到这两家。

## Capabilities

- `skill-usage-collection`：probe 覆盖扩展（hermes / deepseek-harness）。

## Impact

- 新增 `packages/hub/src/usage/probe-hermes.ts`、`probe-dsh.ts` 及 fixture 单测；`defaultProbes()` 注册。
- renderer 设置面板 Agent 开关清单与证据标注小改。无 state 结构变更。
