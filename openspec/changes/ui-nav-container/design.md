# Design: UI Nav Container

## Context

`Header.tsx` 当前结构：`header.header-aurora.sticky.top-0.z-40.border-b.border-white/[0.06]`，内部 `div.mx-auto.max-w-6xl.px-4.h-16`。aurora 背景是动画渐变，但在滚动时导航条与内容区分度不足，且 `px-4`（16px）在宽屏下让内容显得贴边。

## Goals / Non-Goals

**Goals:** 增加横向呼吸空间、强化导航条容器层次，保持 sticky 与 aurora 基调。

**Non-Goals:** 不重构导航信息架构，不新增导航项，不改动移动端交互逻辑。

## Decisions

### 1. 横向 padding 提升到 px-6 md:px-8
内部容器 `px-4` → `px-6 md:px-8`，宽屏下为 Logo 与操作入口提供 24–32px 呼吸空间。

### 2. 导航背景叠加半透明层 + 毛玻璃
在保留 `header-aurora` 的前提下，给 header 增加 `bg-[#0d0a1a]/75 backdrop-blur-xl`，让滚动时导航有"实"的容器感。aurora 的 `::before` 动画层仍位于底层，视觉效果保留。

### 3. 边框强化
`border-b border-white/[0.06]` → `border-b border-white/10`，使 sticky 边界更清晰。

## Risks / Trade-offs

- [backdrop-blur 叠加 aurora 可能削弱动画] → aurora 位于背景层，blur 作用于其上方内容，影响可控；如观感变差则回退 backdrop-blur。
- [半透明背景可能盖过 aurora 渐变] → 用 75% 透明度平衡，保留可感知的渐变。

## Migration Plan

1. 修改 `Header.tsx` 的 header 与内部容器 className。
2. 补单元测试与 E2E 验收。

Rollback: 单文件样式改动，回退 Header.tsx 即可。
