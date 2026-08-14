# Design: UI Filter Bar

## Context

`SkillCardGrid.tsx` 筛选区：分类标签 `gap-1.5`，右侧 `{total}` 裸数字 + 无边框筛选图标。视觉松散、计数语义不明。

## Goals / Non-Goals

**Goals:** 提升标签间距、计数语义与筛选按钮存在感，不改变筛选交互逻辑。

**Non-Goals:** 不新增筛选维度，不改动分类/评分/来源的筛选行为。

## Decisions

### 1. 标签间距 gap-2
分类标签容器 `gap-1.5` → `gap-2`（8px）。

### 2. 计数胶囊化
`{total}` 裸数字改为 `<span>{total} <span>skills</span></span>` 胶囊容器，`border-white/10` + 内边距，主数字 `text-white/70`，标签 `text-white/50`。

### 3. 筛选按钮加边框
筛选图标按钮加 `border` 容器，选中态 `border-ripple-500/40`，默认态 `border-white/[0.12]`。

## Risks / Trade-offs

- [计数胶囊可能视觉过重] → 用 10% 白边框 + 小字号（11px）保持克制。

## Migration Plan

1. 修改 `SkillCardGrid.tsx` 筛选区三处 className/结构。
2. 补单元测试与 E2E 验收。

Rollback: 单文件样式改动。
