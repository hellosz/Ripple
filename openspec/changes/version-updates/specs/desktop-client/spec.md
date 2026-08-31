# desktop-client（delta）

## ADDED Requirements

### Requirement: 关于与更新
设置 MUST 提供「关于与更新」tab：显示当前版本与更新通道（GitHub Release）；「检查更新」按钮 MUST 呈现完整状态流——检查中、已是最新、发现新版（含版本号）、下载进度百分比、已就绪（提供「重启安装」）、失败（含原因，且不阻塞使用）；开发模式（未打包）MUST 明确提示不检查更新。

#### Scenario: 手动检查发现新版
- **WHEN** 用户点击「检查更新」且 GitHub Release 存在更高版本
- **THEN** 显示新版本号与下载进度，下载完成后可点「重启安装」完成升级

#### Scenario: 已是最新
- **WHEN** 用户点击「检查更新」且当前即最新
- **THEN** 显示"已是最新版本 vX.Y.Z"
