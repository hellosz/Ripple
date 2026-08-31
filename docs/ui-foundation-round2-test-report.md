# UI 视觉优化（第二轮）提测文档

> 提测日期：2026-08-13
> 提测范围：Ripple 前端「导航容器层次 / 标题强调 / 搜索框主操作感 / 筛选区间距」四项优化
> 流程：OpenSpec SDD（Spec-Driven Development），每个变更独立 change，含单元测试与端到端验收

---

## 一、变更概述

本轮针对首轮 UI 评审暴露的 4 个次级问题，拆分为 4 个独立的 OpenSpec 变更（change），每个变更均走完整 SDD 流程（proposal → specs → design → tasks）并配套单元测试 + 端到端验收。

| # | Change 名称 | 目标 | 主要改动文件 |
|---|---|---|---|
| 1 | `ui-nav-container` | 导航容器层次与横向留白 | `Header.tsx`、`globals.css` |
| 2 | `ui-hero-heading` | 首屏标题品牌词强调 | `page.tsx` |
| 3 | `ui-search-input` | 搜索框主操作感 | `SearchBar.tsx` |
| 4 | `ui-filter-bar` | 筛选区间距与计数语义 | `SkillCardGrid.tsx` |

## 二、变更明细

### Change 1 — ui-nav-container（导航容器层次）

- 导航内部横向留白 `px-4` → `px-6 md:px-8`（宽屏下 Logo 与操作入口不再贴边）。
- 导航底部边框强化为 `border-white/10`。
- **修复 bug**：`globals.css` 中 `.header-aurora` 的 `position: relative` 覆盖了 Tailwind `sticky`，导致导航滚动时从不固定。已移除该覆盖，`sticky` 真正生效。

### Change 2 — ui-hero-heading（标题强调）

- 首屏标题 "One Drop, Endless **Ripples.**" 中品牌词 "Ripples." 由 `text-white/30`（低对比灰紫）改为 `text-ripple-400`（品牌紫 `#a78bfa`），使其成为视觉焦点而非弱化元素。

### Change 3 — ui-search-input（搜索框主操作感）

- 搜索框高度 `py-3` → `py-3.5`（约 52px）。
- 默认态边框 `border-white/[0.14]` → `border-white/[0.2]`。
- 新增 `hover:border-white/[0.28] hover:bg-white/[0.08]` 悬停反馈与 `focus:border-ripple-400/70` 品牌色聚焦高亮。

### Change 4 — ui-filter-bar（筛选区间距）

- 分类标签间距 `gap-1.5` → `gap-2`（8px）。
- 结果计数由裸数字改为带 "skills" 标签的胶囊容器（如 "4 skills"），语义明确。
- 筛选图标按钮增加边框容器，成为可辨识的操作入口。

## 三、测试基础设施（本轮新增）

| 层 | 技术 | 位置 |
|---|---|---|
| 单元测试 | vitest 4 + React Testing Library + jsdom | `frontend/vitest.config.ts`、`frontend/src/**/*.test.tsx` |
| 端到端 | Playwright（系统 Chrome） | `playwright.config.ts`、`e2e/*.spec.ts` |

## 四、测试结果

### 单元测试 — 9/9 通过

| 测试文件 | 用例数 | 覆盖 |
|---|---|---|
| `Header.test.tsx` | 3 | 上传按钮 aria-label、Login 按钮、登录态昵称 |
| `HomePage.test.tsx` | 2 | 标题渲染、品牌词强调色 class |
| `SearchBar.test.tsx` | 1 | 占位符输入框渲染 |
| `SkillCardGrid.test.tsx` | 2 | 计数 "skills" 标签、筛选按钮 |
| `smoke.test.tsx` | 1 | RTL + jest-dom 基础设施 |

### 端到端测试 — 5/5 通过

| 测试文件 | 断言要点 |
|---|---|
| `smoke.spec.ts` | 首页加载、H1 品牌标题 |
| `nav.spec.ts` | 导航 `position: sticky`、有底部边框、横向留白 ≥24px |
| `hero.spec.ts` | "Ripples." 为紫色系强调色（蓝通道 > 红通道），非低对比灰 |
| `search.spec.ts` | 搜索框高度 ≥48px、边框非透明 |
| `filter.spec.ts` | 计数带 "skills" 标签、筛选按钮有边框 |

### 构建验证

- `pnpm --dir frontend build` 通过（含 TypeScript 类型检查）。

## 五、验收清单（请逐项确认）

### Change 1 — 导航容器

- [ ] 桌面宽屏（≥1280px）下，导航 Logo 与右侧操作距页面边缘有明显留白（≥24px）。
- [ ] 向下滚动页面时，顶部导航保持固定（sticky 生效）。
- [ ] 导航底部有清晰边框，与页面内容区分。

### Change 2 — 标题强调

- [ ] 首页首屏 "Ripples." 为紫色品牌色（非灰白色），是标题的视觉焦点。

### Change 3 — 搜索框

- [ ] 搜索框有足够高度（≥48px）与清晰边框，表现为可交互入口。
- [ ] 悬停搜索框时边框/背景增强。

### Change 4 — 筛选区

- [ ] 分类标签之间间距清晰（≥8px），不拥挤。
- [ ] 结果计数显示为 "N skills"（带语义标签），而非裸数字。
- [ ] 筛选图标按钮有边框容器，可辨识。

## 六、如何运行测试

```bash
# 启动服务
pnpm docker:up          # 中间件（如未启动）
pnpm dev                # 后端 :8000 + 前端 :3000

# 单元测试
cd frontend && pnpm test

# 端到端测试（需前端 :3000 运行）
npx playwright test

# OpenSpec 校验
pnpm exec openspec validate --all
```

## 七、已知问题 / 注意事项

1. **dev 与 build 共用 `.next` 缓存目录会互相污染**：dev server 运行时请勿执行 `pnpm build`，否则 dev 会报 500，需重启 dev。验证编译请用 `pnpm lint` + `pnpm test`。
2. 首页左下角可能出现的圆形悬浮按钮为浏览器扩展（ChatGPT for Chrome）注入，非项目元素，验收时请忽略（E2E 已用 `--disable-extensions` 排除）。
3. 本轮为纯样式改动，不涉及后端、数据模型、API 契约变更。

## 八、交付物清单

- OpenSpec 变更（4 个）：`openspec/changes/ui-{nav-container,hero-heading,search-input,filter-bar}/`
- 单元测试：`frontend/src/**/*.test.tsx`（5 个文件，9 用例）
- E2E 测试：`e2e/*.spec.ts`（5 个文件，5 用例）
- 测试配置：`frontend/vitest.config.ts`、`frontend/vitest.setup.ts`、`playwright.config.ts`
