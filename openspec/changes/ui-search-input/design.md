# Design: UI Search Input

## Context

`SearchBar.tsx` 静态搜索框（expandable 入口）当前 `py-3 border-white/[0.14] bg-white/[0.06] placeholder-white/50`。第一轮已提升过对比，但仍显单薄。

## Goals / Non-Goals

**Goals:** 增强搜索框的输入主操作感，保持 expandable 交互不变。

**Non-Goals:** 不改变 expandable 展开逻辑与 overlay 行为，不新增搜索能力。

## Decisions

### 1. 高度与边框提升
`py-3` → `py-3.5`（约 52px 高），边框 `border-white/[0.14]` → `border-white/[0.2]`。

### 2. hover/focus 反馈
默认态增加 `hover:border-white/[0.28] hover:bg-white/[0.08]`，focus 时 `focus:border-ripple-400/70` 品牌色高亮。

## Risks / Trade-offs

- [边框过强破坏克制基调] → 用 20% 白平衡，仍是半透明而非实线。

## Migration Plan

1. 修改 `SearchBar.tsx` 静态输入框 className。
2. 补单元测试与 E2E 验收。

Rollback: 单文件样式改动。
