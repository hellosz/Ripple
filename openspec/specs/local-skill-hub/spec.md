# local-skill-hub Specification

## Purpose
TBD - created by archiving change desktop-refinements-v3. Update Purpose after archive.
## Requirements
### Requirement: 场景分析结果持久化
hub MUST 提供技能场景分析结果的读写（标签四类 + 概要 + 生成时间 + 内容指纹），随 state 持久化；技能卸载（最后一处）时清理其结果。

#### Scenario: 指纹感知
- **WHEN** 技能内容变化后读取场景分析
- **THEN** 结果携带旧指纹，调用方可据此提示重新分析

### Requirement: 素材文件读取
hub SHALL 提供单个素材文件读取（返回 base64 与 mime 推断，大小上限 5MB），供查看器预览图片等二进制资源；路径 MUST 防穿越。

#### Scenario: 读取图片
- **WHEN** 请求技能内 assets/logo.png
- **THEN** 返回其 base64 与 image/png 类型

### Requirement: 共享目录支持度修正
适配器注册表的 sharedDirSupport MUST 与逐 Agent 调研证据一致；无证据的 Agent 保守标记 false 并在代码注释注明依据。

#### Scenario: 证据驱动
- **WHEN** 调研确认某 Agent 原生扫描 ~/.agents/skills
- **THEN** 其 sharedDirSupport 为 true，placement 走通用引入

