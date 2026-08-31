# Audit: decouple-shared-storage

## Before This Change

- 技能可见性与「存储位置」耦合：内置模式下 `~/.agents/skills`（openskills/npx skills 等社区工具的默认落点）完全不被识别——真实事故：ask-matt / setup-matt-pocock-skills 已装但列表不显示。
- 共享落点判定依赖全局 `storage_location === 'shared'`；内置 SSOT 的技能无法共享给支持共享标准的 Agent。

## Gaps Identified

- `skillDir` 读写共用一个解析会导致 install 写进共享目录第三方内容 → 拆分 `primarySkillDir`（写，恒为自有 SSOT）与 `skillDir`（读，SSOT 优先/共享回退）。
- 弹窗「专属」勾选原本不带 `dedicated` 标记，解耦后会被误判为共享 → 全局 Agent 显式勾选补 `dedicated: true`。
- 共享目录同名冲突（非我方链接的真实内容）→ 共享操作明示失败，绝不覆盖。

## Implemented Contract

- **hub**：`sharedDir` 恒被识别；`listSkillNames()` 双根枚举去重；`skillDir` 读解析 + `primarySkillDir` 写落点；`skillInSharedDir`；`distributeTo` 共享判定改为"技能实际在共享目录"，内置 SSOT 共享 → 在 `~/.agents/skills` 建 symlink（dist_mode 降级 copy 语义沿用，冲突明示）；`removeDistribution` 最后一个 shared 落点移除时仅删"确认指向 `~/.ripple/skills` 的链接"；`backupAgents` 共享型 Agent 覆盖共享目录全集（与存储配置解耦）。
- **desktop**：snapshot 双根枚举 + `skills[].shared` 标记；「共享」按钮隐藏与存在矩阵隐式共享态改用该标记；共享弹窗「通用」选项恒可用（专属项带 dedicated）；设置存储位置补说明"仅决定 Ripple 自装技能的存放；共享目录始终被识别"。
- 测试：hub 83 测全绿（新增 4：内置识别共享技能/SSOT 优先、共享 symlink 建立与安全移除（第三方目录不动）、同名冲突拒绝、通用模式行为不变；旧同步用例按新语义更新含 dedicated 路径）；全仓 160 测、tsc/eslint/electron-vite build 通过。
