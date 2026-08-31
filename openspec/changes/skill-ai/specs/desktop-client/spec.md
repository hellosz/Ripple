# desktop-client（delta）

## ADDED Requirements

### Requirement: AI 设置与技能优化入口
设置 MUST 新增 AI 服务商 tab（服务商选择/baseUrl/model/apiKey/连接测试）；技能详情 MUST 提供「评分」与「优化」入口，优化结果以 diff 视图对比并可应用。

#### Scenario: 首次配置后使用
- **WHEN** 用户配置服务商后对技能点击「优化」
- **THEN** 展示建议清单与 diff，可一键应用
