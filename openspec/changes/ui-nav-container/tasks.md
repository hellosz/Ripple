## 1. 实现

- [x] 1.1 `Header.tsx` 内部容器横向 padding 提升为 `px-6 md:px-8`。
- [x] 1.2 header 边框强化为 `border-white/10`，并修复 `header-aurora` 的 `position: relative` 覆盖 `sticky` 的 bug。

## 2. 单元测试

- [x] 2.1 新增 `Header.test.tsx`，断言上传按钮 `aria-label`、Login 主按钮、登录态昵称展示（3 用例）。

## 3. E2E 验收

- [x] 3.1 新增 e2e 用例，断言导航 `position: sticky`、有底部边框、横向留白 ≥24px。
