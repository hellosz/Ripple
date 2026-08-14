# UI Search Input

## Why

首页搜索框（expandable 触发入口）占据较大宽度，但高度与描边偏弱，默认态仍像禁用组件，缺少"可输入"的主操作感。

## What Changes

- 增加搜索框高度（`py-3` → `py-3.5`）。
- 强化默认态边框（`border-white/[0.14]` → `border-white/[0.2]`）。
- 为默认态增加 hover 反馈与 focus 时品牌色高亮，使输入入口感更明确。

## Capabilities

### New Capabilities
- `ui-search-input`: 定义搜索框默认态的高度、边框与交互反馈。

### Modified Capabilities
- None.

## Impact

- 前端：`frontend/src/components/layout/SearchBar.tsx`（唯一改动文件）。
- 不涉及后端、数据、API。
