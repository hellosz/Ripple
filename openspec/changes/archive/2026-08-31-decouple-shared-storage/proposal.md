# Proposal: decouple-shared-storage

## Why

用户用社区工具（openskills、npx skills 等）安装的技能默认落在 `~/.agents/skills`（生态标准目录），但当前桌面端的技能列表只扫描「存储位置」指向的单一 SSOT 根：存储位置为「内置」时 `~/.agents/skills` 里的技能完全不可见（真实事故：ask-matt / setup-matt-pocock-skills 已安装但列表看不到）。存储位置配置把"我们自己装哪"与"识别哪里"耦合在了一起。

## What Changes

- **共享目录始终识别**：`~/.agents/skills` 无条件纳入技能枚举与目录解析，与存储位置配置无关。
- **存储位置语义收窄**：仅决定 Ripple 自装技能的 SSOT 落点（内置 `~/.ripple/skills` / 通用 `~/.agents/skills`），不再影响可见性。
- **技能目录解析**：自有 SSOT 优先，共享目录回退；两处都有同名目录时以 SSOT 为准。
- **共享落点与 SSOT 解耦**：技能实际位于共享目录 → 支持共享标准的 Agent 零分发（现状）；技能在内置 SSOT 时执行「共享」→ 在 `~/.agents/skills` 创建指向 SSOT 的 symlink（失败降级 copy）；移除共享落点时仅删除指向我方 SSOT 的链接，社区第三方内容绝不触碰。
- 桌面端：快照按技能标注是否已在共享库（`shared`），「共享」按钮隐藏条件改为该标记；设置文案说明解耦语义。

## Capabilities

- `local-skill-hub`：目录解析与共享落点解耦。
- `desktop-client`：列表/按钮/文案适配。

## Impact

- `packages/hub`（skillDir 解析、distributeTo/removeDistribution）、`apps/desktop`（snapshot、设置、skill-list）。无 state schema 变更、无破坏性迁移；行为向后兼容（通用模式下行为不变）。
