# UI Foundation Polish

## Why

首轮全站 UI 评审（DOM 审计 + 多模态视觉评审交叉验证）发现，Ripple 前端存在一组互相耦合的"视觉基础"问题：正文/标签/作者信息/图标对比度严重不足、卡片无层次、内容版心偏左、Hero 占屏过大、搜索框像禁用态、顶部导航操作入口不清晰。这些问题都指向同一个根因——**缺少一套统一的设计 token 与布局规范**，导致各处散落使用低对比度颜色、无阴影卡片、不居中的内容容器。

## What Changes

- 建立并落地统一的设计 token（语义色/边框/阴影/间距），替换组件里散落的低对比度颜色。
- 提升全站文本对比度（次级文字、标签、作者信息、图标、Login），满足可读性要求。
- 给技能卡片增加层次（柔和阴影 + 强化边框），保留深色科技感基调。
- 统一内容版心居中，消除宽屏下右侧大面积空白。
- 压缩 Hero 首屏高度，提升有效内容密度。
- 强化搜索框的交互态（边框/背景/图标对比）。
- 优化顶部导航（sticky + 毛玻璃、操作图标语义化、Login 强化）。

## Capabilities

### New Capabilities
- `ui-visual-tokens`: 定义全局语义设计 token（文本层级色、表面色、边框、阴影），并约束组件按 token 使用颜色与卡片层次。
- `ui-layout-header`: 定义内容版心居中、Hero 首屏高度、搜索框交互态与顶部导航的行为和视觉。

### Modified Capabilities
- None.

## Impact

- 前端：`globals.css`（token 与阴影）、`tailwind.config.ts`（必要时扩展）、`layout.tsx`、`page.tsx`（Hero）、`Header.tsx`、`SearchBar.tsx`、`SkillCard.tsx`/`SkillCardGrid.tsx`（卡片层次）以及若干使用低对比度颜色的组件。
- 不涉及后端、数据模型、API 契约变更。
- 文案语言策略（中英统一）作为低优先级项纳入，不阻塞主视觉落地。
