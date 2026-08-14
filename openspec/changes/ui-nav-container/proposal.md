# UI Nav Container

## Why

首页顶部导航在宽屏下存在两个问题：Logo 与右侧操作距页面边缘的横向呼吸空间不足，且导航条缺少明确的"容器"层次——背景与下方内容区分度低，视觉发空、像浮在页面上。

## What Changes

- 增加导航内部横向呼吸空间（`px-4` → `px-6 md:px-8`）。
- 为导航条增加半透明背景与毛玻璃模糊，强化其与页面内容的容器区分。
- 强化导航底部边框，使 sticky 导航在滚动时有清晰的边界感。

## Capabilities

### New Capabilities
- `ui-nav-container`: 定义顶部导航容器的横向留白、背景层次与边框视觉。

### Modified Capabilities
- None.

## Impact

- 前端：`frontend/src/components/layout/Header.tsx`（唯一改动文件）。
- 不涉及后端、数据、API。
