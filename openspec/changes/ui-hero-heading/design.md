# Design: UI Hero Heading

## Context

`page.tsx` 首屏 h1 为 `One Drop, Endless <span className="text-white/30">Ripples.</span>`。`text-white/30`（30% 白）在深色背景上对比度不足，且把品牌词弱化成了辅助元素。

## Goals / Non-Goals

**Goals:** 让 "Ripples." 成为标题强调点，保持简洁。

**Non-Goals:** 不引入渐变文字/自定义字体（后续品牌视觉专项），不改动标题文案。

## Decisions

### 1. 用 ripple-400 强调
`text-white/30` → `text-ripple-400`（`#a78bfa`）。ripple 色板是现成的品牌主色，400 档在深色背景上对比度充足，且与紫色系品牌基调一致。

Alternative considered: 渐变文字（bg-clip-text）。Rejected：本轮保持简单，避免增加复杂度。

## Risks / Trade-offs

- [紫色与背景 aurora 紫可能接近] → ripple-400（`#a78bfa`）亮度足够，与深紫背景有区分。

## Migration Plan

1. 修改 `page.tsx` 标题 span 的 className。
2. 补单元测试与 E2E 验收。

Rollback: 单文件单行样式改动。
