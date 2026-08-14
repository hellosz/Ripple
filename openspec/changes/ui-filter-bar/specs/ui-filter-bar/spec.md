## ADDED Requirements

### Requirement: 筛选区标签间距清晰
系统 SHALL 让筛选区的分类标签之间保持清晰的间距（≥8px），避免标签拥挤。

#### Scenario: 标签间距充足
- **WHEN** 首页筛选区渲染分类标签
- **THEN** 相邻标签间距不小于 8px

### Requirement: 结果计数语义明确
系统 SHALL 让筛选区右侧的结果计数带明确的"skills"语义标签，而非裸数字。

#### Scenario: 计数带语义
- **WHEN** 首页筛选区渲染结果计数
- **THEN** 计数以带"skills"标签的容器呈现，用户能理解其为技能数量

### Requirement: 筛选按钮可辨识
系统 SHALL 让筛选图标按钮带边框容器，成为可辨识的操作入口。

#### Scenario: 筛选按钮有容器
- **WHEN** 首页筛选区渲染筛选图标按钮
- **THEN** 按钮带可见边框，与周围元素形成可感知的操作入口
