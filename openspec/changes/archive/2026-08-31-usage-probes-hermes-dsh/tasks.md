# Tasks: usage-probes-hermes-dsh

## 1. probe 实现
- [x] 1.1 probe-hermes：skill_view 工具行解析（tool-call 证据、字节游标）；fixture 单测（识别/增量/meta 不计数）
- [x] 1.2 probe-dsh：zstd 多帧分割解压（合并重试）、SKILL.md 白名单启发式、size+mtime 游标整扫、available() 探测；fixture 单测（多帧/白名单/未变更跳过/不可用跳过）
- [x] 1.3 defaultProbes 注册两条目
- [x] 1.4 renderer：设置按 Agent 开关加 hermes/deepseek-harness；使用区块证据标注（deepseek-harness=路径启发）
- [x] 1.5 全部门禁 + 真实数据冒烟（本机开启采集扫出 hermes/dsh 事件）
