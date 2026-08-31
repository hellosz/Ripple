# UI Hero Heading

## Why

首页首屏标题 "One Drop, Endless **Ripples.**" 中，核心品牌词 "Ripples." 使用 `text-white/30` 低对比灰紫，被弱化为次要元素，与白色标题的强调关系不自然——恰恰是最该被强调的品牌表达反而最弱。

## What Changes

- 将标题中 "Ripples." 从低对比灰紫（`text-white/30`）改为品牌主色强调（`text-ripple-400`），使品牌词成为视觉焦点。

## Capabilities

### New Capabilities
- `ui-hero-heading`: 定义首页首屏标题的品牌词强调色与对比度。

### Modified Capabilities
- None.

## Impact

- 前端：`frontend/src/app/page.tsx`（唯一改动文件）。
- 不涉及后端、数据、API。
