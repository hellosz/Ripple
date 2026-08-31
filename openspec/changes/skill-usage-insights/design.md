# Design: skill-usage-insights

## Context

各 Agent 的 session/transcript 均为无稳定性承诺的私有格式；本机实测（2026-08-31）：Claude Code jsonl（信封含 version/cwd/timestamp，`Skill` 工具调用 59 次样本）、OpenCode SQLite（`part.data` 中 `tool:'skill'`，27 条样本）、Codex rollout jsonl（SKILL.md 路径出现在 exec 命令中）。单会话 jsonl 可达 9.3MB。hub 被 desktop 与 CLI 共享，CLI 声明 Node ≥ 20。

## Goals / Non-Goals

- Goals：零侵入被动采集；幂等增量；隐私默认最小化；证据等级透明；新增 Agent 仅注册表扩展。
- Non-Goals：不做 hooks 主动上报（留作后续增强）；不覆盖 Cursor/Pi/Hermes 强信号；不上传使用数据。

## Decisions

1. **被动扫描而非 hooks/watcher**。备选 hooks（Claude Code PostToolUse、OpenCode plugin）精确但要改用户 agent 配置、仅覆盖两家，作为后续可选增强；递归 watcher 在纯 Node（fs.watch）下 Linux 语义不可靠且句柄开销大，回顾型功能分钟级延迟无感 → 定时增量扫描。
2. **存储用 JSONL 分片而非 node:sqlite**。`node:sqlite` 需 Node ≥ 22.5，与 CLI Node ≥ 20 冲突且仍 experimental；单机事件量级小，JSONL append 天然增量、聚合可重建。量级超标后迁移 sqlite 的 schema 已按表设计（events/cursors/stats）。
3. **opencode probe 运行时探测 `node:sqlite`**：`import('node:sqlite')` 失败则该 probe 标记不可用（desktop Electron 主进程 Node ≥ 22 可用；CLI Node 20 自动跳过）。
4. **事件 id 幂等**：`sha256(agent + session_id + toolCallId|行uuid|行号)`，重扫去重靠 id 集合（当月分片加载为 Set）。
5. **启发式白名单**：codex 路径匹配出的技能名必须存在于 hub SSOT，否则丢弃（防误报）。
6. **隐私默认最小化**：默认 opt-in 关闭；trigger_hint 首期不做（连结构化入参都不落），后续如需"增强档"另立 change。

## Risks

- 格式漂移：解析按"失败即跳过"，probe 单测用脱敏 fixture 固化当前格式，格式变更表现为漏采而非崩溃。
- 大文件：流式逐行 + 字节游标；truncation 检测（size 变小）触发重扫。
- 误报/漏报：证据等级在 UI 标注，启发式仅作参考信号。

## Migration

无破坏性变更。HubState 新增 `usage_collection`（总开关+按 agent）字段由 loadState 前向兼容补齐，默认关闭。

## Open Questions

- OpenClaw/DSH probe（次期）：DSH zstd 多帧解压需循环按帧处理（实测 zlib.zstdDecompressSync 只解首帧）。
