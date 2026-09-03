# Design: usage-quality-signals

## Context

事件明细（session/时间/项目/evidence）已持久化且幂等；共现、重复加载、陈旧度可纯读侧派生。触发方式与 references/scripts 跟随需要 probe 侧新标注。旧事件无新字段。

## Goals / Non-Goals

- Goals：P0（手动占比/重复加载/共现/陈旧度）+ P1（references/scripts 跟随率）+ 建议标签；喂给 AI 优化上下文。
- Non-Goals：触发轮次精确位置、修正循环密度、会话结局（P2 另立）；不改事件存储格式（仅加可选字段）。

## Decisions

1. **可选字段而非新表**：`trigger?`/`resource?` 加在 UsageEvent 上，旧事件按缺省语义（无 trigger 标注、resource=skill 触发）解释，幂等 id 机制不变。
2. **使用次数口径**：只计触发事件。理由：references 读取次数受技能结构影响巨大，混入会让"次数"失真；跟随事件单独服务跟随率。
3. **manual 检测**：claude-code user 行的 `<command-name>` 内容去掉前导 `/` 与命名空间前缀后与 SSOT 技能名精确匹配才计（防误报）；manual 事件的调用标识用行 uuid。
4. **跟随率分母**：触发会话数（非触发次数）——一个会话读没读 references 是会话级行为。
5. **标签阈值**（表驱动，测试固化，经验起点可调）：见 spec。
6. **scripts "执行 vs 阅读"不区分**：启发式无法可靠区分，统一计访问；标签文案用"跟随"。

## Risks

- slash 命令名与技能名不一致（如插件命名空间）→ 白名单精确匹配宁漏勿误。
- codex/dsh 的 reference 访问是路径启发，会低估跟随率 → UI 标注证据等级沿用。

## Migration

无。旧事件自然并入新口径。
