## 1. 设计 token 基座

- [x] 1.1 在 `globals.css` 的 `:root` 扩充语义变量：`--text-primary`、`--text-secondary`、`--text-muted`、`--surface-elevated`、`--border-strong`、`--shadow-card`。
- [x] 1.2 组件用 Tailwind 类对齐 token 数值（`text-white/70`/`/60`、`shadow-[0_8px_30px_rgba(0,0,0,0.35)]`），无需额外 Tailwind 映射。

## 2. 对比度提升

- [x] 2.1 替换首页卡片（`SkillCard`）中作者名、标签、描述的低于 0.5 透明度颜色为 60–70% 白。
- [x] 2.2 详情页为浅色卡片设计，对比度本就满足；已统一其工具栏/元信息色值。
- [x] 2.3 替换导航（`Header`）Login 与"+"图标颜色为满足对比度的次级色。

## 3. 卡片层次

- [x] 3.1 给技能卡片加柔和阴影（`shadow-[0_8px_30px_rgba(0,0,0,0.35)]`）并强化边框（`white/12%`）。
- [x] 3.2 为卡片增加悬停态（边框 `white/20%`、表面色 `white/6%`）。

## 4. 版心与 Hero

- [x] 4.1 定位版心偏左根因（详情页 `xl:grid-cols-[1fr_240px]` 在无目录时右侧空列），改为条件两栏。
- [x] 4.2 压缩 `page.tsx` Hero 区垂直 padding（`pt-16→pt-10`、`md:pt-24→md:pt-14`）。

## 5. 搜索框

- [x] 5.1 强化 `SearchBar` 默认态边框（`white/14%`）、背景（`white/6%`）、图标与占位文字对比。

## 6. 导航 Header

- [x] 6.1 `Header` 已是 sticky，确认保留并维持毛玻璃/aurora 背景。
- [x] 6.2 Login 提升为带边框主按钮样式，"+"图标补充 `aria-label` 与容器边框。

## 7. 验证

- [x] 7.1 重新截图首页/详情页/guide，用 `vision.sh` 复检——对比度与卡片层次已确认改善。
- [x] 7.2 跑 `pnpm build` 通过；顺带修复 `RippleVisualization` 遗留类型错误（`viewed` → `consumed`）。
