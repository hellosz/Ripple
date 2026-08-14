# Design: UI Foundation Polish

## Context

Ripple 前端已完成基础功能，但视觉仍显"雏形"。首轮评审（Playwright DOM 审计 + codex 多模态视觉评审）定位到一组根因一致的问题：组件散落使用低对比度颜色（`text-white/40`、`text-gray-500` 等）、卡片无阴影（`box-shadow: none`、边框 `white 6%`）、内容版心疑似偏左、Hero 占屏过大、搜索框默认态过暗、导航操作入口无标签。

现有基础设施：`globals.css` 已有少量 CSS 变量（`--background/--foreground/--surface/--border`），`tailwind.config.ts` 有 `ripple` 紫罗兰色板（50–950），并有 aurora/ripple 等动画资产。本设计在不推翻现有深色科技感基调的前提下，补齐设计 token 与布局规范。

## Goals / Non-Goals

**Goals:**
- 建立可复用的语义设计 token（文本层级、表面、边框、阴影）。
- 把全站低对比度文本提升到可读水平。
- 给卡片增加层次、让版心居中、压缩 Hero、强化搜索框与导航。
- 改动可控、可逐步落地、可截图复检。

**Non-Goals:**
- 不重做信息架构，不新增页面或功能。
- 不引入组件库或 UI 框架。
- 不处理动画/动效的细节打磨（后续专项）。
- 不统一中英文案（列为低优先级，不阻塞本轮）。

## Decisions

### 1. 设计 token 走 CSS 变量，落在 `globals.css`
扩充 `:root` 的语义变量，组件通过变量引用，避免散落 rgba 值。新增：`--text-primary`（= `--foreground`）、`--text-secondary`（≈ `rgba(255,255,255,0.72)`）、`--text-muted`（≈ `rgba(255,255,255,0.55)`）、`--surface-elevated`（≈ `rgba(255,255,255,0.06)`）、`--border-strong`（≈ `rgba(255,255,255,0.14)`）、`--shadow-card`。

Alternative considered: 全部改用 Tailwind `ripple` 色板。Rejected：色板是紫罗兰主色，但深色 UI 的文本/边框层级更适合用中性灰白透明度变量，语义更清晰。

### 2. 对比度分三档，替换低对比灰
- 主文本：`--text-primary`（`#e8e4f0`，现状 `--foreground`）
- 次级文本（作者名、标签、元信息、结果数）：从 `white/40` 提到 `--text-secondary`（≥0.72）
- 弱化文本（占位、辅助说明）：`--text-muted`（≥0.55），不再低于 0.5

Alternative considered: 只把 `white/40` 全局改 `white/60`。Rejected：仍是硬编码透明度，无法形成 token 契约。

### 3. 卡片层次：柔光阴影 + 强化边框
卡片加 `box-shadow: var(--shadow-card)`（如 `0 8px 30px rgba(0,0,0,0.35)`），边框从 `white 6%` 提到 `--border-strong`（14%），悬停时表面色从 `--surface` 提升到 `--surface-elevated`。

Alternative considered: 用大投影 + 明显边框做"玻璃拟态"卡片。Rejected：易显得花哨，与现有克制基调不符，柔光阴影更稳妥。

### 4. 版心居中：统一 `main` 容器约束
`layout.tsx` 的 `main` 已是 `max-w-6xl mx-auto`，但详情页等子页面内部可能存在额外左偏移或非对称布局。落地时先核实具体组件，再统一为对称留白；必要时把 `max-w-6xl` 调整为更紧凑的 `max-w-5xl` 以适配内容密度。

### 5. Header：sticky + 毛玻璃
Header 从透明改为 `sticky top-0 z-40` + 半透明背景 + `backdrop-blur`，滚动时内容不与导航混淆。右侧操作（"+"、Login）补充语义：Login 提升为有边框/背景的主按钮，"+" 加 `aria-label` 与 hover 态。

### 6. Hero 压缩
`page.tsx` Hero 区 `pt-16 md:pt-24 pb-10 md:pb-14` 压缩约 40%，并收紧标题与引语、搜索框的间距，使首屏露出卡片。

### 7. 搜索框交互态
`SearchBar.tsx` 默认态提高边框与图标对比（引用 `--border-strong` 与 `--text-secondary`），占位文字用 `--text-muted`，输入聚焦时边框高亮为 `ripple` 主色。

## Risks / Trade-offs

- [改对比度可能影响整体暗色氛围] → 用中性灰白透明度变量，保持深色基调，只提可读性。
- [版心偏左根因未完全定位] → tasks 中先"核实具体组件"再改，避免盲目加容器。
- [多文件散落颜色，批量替换易遗漏] → 以 token 为锚，先定义变量再按组件逐个替换，配合截图复检。
- [视觉主观性] → 每轮改动后用 vision 脚本复查，形成「改→截图→评」闭环。

## Migration Plan

1. 在 `globals.css` 扩充语义 token。
2. 按组件逐步替换低对比颜色与卡片层次。
3. 修正版心、Hero、搜索框、Header。
4. 每完成一个模块即截图，用 `vision.sh` 复检对比度与布局。
5. 全部完成后跑 `openspec validate` 与前端 lint/build 验证。

Rollback strategy: 改动集中在样式层，逐文件提交；若某模块视觉回归，回退该文件即可，不影响功能。

## Open Questions

- 版心偏左的确切来源是 `main` 容器还是详情页内部 grid？实施时先核实。
- 是否需要引入自定义字体（品牌字体）替代系统字体？本轮不纳入，作为后续「品牌视觉」专项。
- 中英文案统一策略（全英文 vs 全中文 vs 保留现状）需产品确认，暂不阻塞。
