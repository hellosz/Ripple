# Design: skill-discovery

## Context

GitHub repo search 免鉴权 10 次/分钟、60 次/小时/IP；code search 强制 PAT 且 10 次/分钟。codeload tarball 不计 REST 配额（社区官方答复），现有 `tarballUrl()/scanTarballSkills()` 直接复用。`topic:agent-skills` ≈ 1.87 万仓库，首位即官方库。agentskills.io 无目录 API；skills.sh/skillsmp 有 API 但引入外部 key 与存续风险。

## Goals / Non-Goals

- Goals：免鉴权即可用的发现体验；质量信号透明；与既有订阅/安装通道零重复；配额降级不报错。
- Non-Goals：不集成第三方聚合站；不做服务端中转（纯客户端直连 GitHub）；不自动安装任何技能。

## Decisions

1. **curated 种子 + topic 搜索**为主（备选 code search 全网发现噪音大且强制 PAT → 仅作 PAT 可选增强）。种子含官方库与 2~3 个 awesome 列表；awesome 解析（README markdown 链接抽取 owner/repo）失败静默降级。
2. **索引 24h TTL + 手动刷新**，单次刷新 ≤ 8 请求；降级链：实时 → 缓存 → 种子。degraded 标记贯穿到 UI。
3. **懒扫描**：仓库技能清单仅在点开时经 codeload tarball 获取（无配额压力），以 branch+pushed_at 作缓存失效键；本地评级复用 skill-core rateSkill（纯函数，无 AI 调用）。
4. **发现与订阅分层**：发现视图只读；「添加为来源」调用既有 addSource 写 SourceRepo，后续安装/同步/指纹更新全走现有社区通道，不出现第二套安装逻辑。
5. **PAT 存储**：桌面 safeStorage 加密（与 AI key 同机制），hub 层只接受运行时传入的 token 字符串，不落盘明文。

## Risks

- 免鉴权 60 次/小时全局硬顶（同 IP 其他工具共享额度）：刷新预算收紧 + 降级 UI。
- topic 依赖作者自觉打标：curated 种子弥补头部漏网。
- awesome 列表格式漂移：解析失败降级为仅官方种子，不阻塞。

## Migration

纯增量，无 state 破坏性变更；`~/.ripple/discover/` 为新目录，可整体删除重建。
