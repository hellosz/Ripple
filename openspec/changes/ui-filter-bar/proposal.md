# UI Filter Bar

## Why

首页筛选区的分类标签、结果计数与筛选图标之间对齐松散，右侧结果计数以裸数字呈现、存在感过低，用户不易理解其含义（是结果数量还是排序控制）。

## What Changes

- 增大分类标签间距（`gap-1.5` → `gap-2`）。
- 将结果计数改为带"skills"文字标签的胶囊容器，提升语义清晰度与存在感。
- 为筛选图标按钮增加边框容器，使其成为可辨识的操作入口。

## Capabilities

### New Capabilities
- `ui-filter-bar`: 定义筛选区标签间距、结果计数语义与筛选按钮的视觉存在感。

### Modified Capabilities
- None.

## Impact

- 前端：`frontend/src/components/skill/SkillCardGrid.tsx`（唯一改动文件）。
- 不涉及后端、数据、API。
