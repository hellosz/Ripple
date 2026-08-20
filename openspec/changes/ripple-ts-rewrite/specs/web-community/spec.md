# web-community

## ADDED Requirements

### Requirement: 视觉体系与全局布局
Web 端 SHALL 采用原型定义的视觉体系：橄榄绿色板（主色 #6b7f43、背景 #faf9f2、深字 #3f4438）、Noto Sans SC + Space Grotesk 字体、涟漪 Logo；设计 token 沉淀于共享 ui 包。全局 Header MUST 包含 Logo、导航（发现/榜单/合辑/文档）、⌘K 搜索入口、"+ 发布技能"入口与个人头像（进入个人中心）。

#### Scenario: 顶部导航跳转
- **WHEN** 用户点击导航"合辑"
- **THEN** 进入合辑页且导航项呈现选中态

### Requirement: 首页 Hero 与水波动画
首页 SHALL 展示 Hero 区："One Drop, Endless Ripples." 主标题、副文案与大搜索框；背景 MUST 渲染水波 canvas 动画（随机雨滴入水激起毛细波+重力波、鼠标移动微扰、点击溅落），动画 MUST 在组件卸载时停止并释放资源。

#### Scenario: 点击 Hero 水面
- **WHEN** 用户在 Hero 区点击
- **THEN** 点击处产生涟漪扩散动画

### Requirement: 信息流与排序 tabs
首页 SHALL 提供 推荐/最热/最新/关注 四个 tab：最热按热度降序、最新按发布时间、关注仅显示已关注作者的技能、推荐按热度与新鲜度加权。信息流卡片 MUST 展示标题、分类、来源（原创/二创/搬运）、描述、热度值（含公式提示）、安装命令（点击复制并反馈"已复制"）、安装与预览按钮、传播/收藏/评论计数、相对时间、社区引语与作者头像。列表 MUST 支持"加载更多"分页与空态提示。

#### Scenario: 复制安装命令
- **WHEN** 用户点击卡片上的安装命令区
- **THEN** `ripple install <slug>` 写入剪贴板，按钮短暂显示"已复制 ✓"，并上报 copy 互动

#### Scenario: 关注 tab 空态
- **WHEN** 用户切到"关注"且无已关注作者的新技能
- **THEN** 显示"这里还很安静"空态与引导文案

### Requirement: 搜索浮层
Web 端 SHALL 提供全局搜索浮层：⌘K/Ctrl+K 或点击搜索框唤起，输入即时显示匹配结果（标题/描述/作者/分类），Enter 将关键词应用到信息流筛选，ESC 关闭。存在生效中的搜索或分类筛选时，信息流上方 MUST 显示筛选说明与"清除"入口。

#### Scenario: 快捷键唤起并应用搜索
- **WHEN** 用户按 ⌘K 输入关键词并回车
- **THEN** 浮层关闭，信息流按关键词过滤并显示可清除的筛选说明

### Requirement: 右栏热度榜与分类
首页右栏 SHALL 展示热度榜 Top5（点击进入详情）、分类筛选 chips（点击过滤信息流）与社区寄语卡（含今日涟漪次数）。

#### Scenario: 点击分类 chip
- **WHEN** 用户点击分类"数据"
- **THEN** 信息流仅显示该分类技能，chip 呈选中态

### Requirement: 技能详情页
详情页 SHALL 包含：返回与分享（复制链接）、分类/来源/版本面包屑、标题与描述、作者信息、安装条（安装命令复制、ZIP 下载、安装按钮）、统计条（热度/传播/收藏/查询 + 传播/收藏操作按钮）、Markdown 内容章节、文件树浏览器（目录展开/文件选中/内容渲染：Markdown 渲染、代码语法高亮、复制源码）、评论区（输入框+嵌套列表）与右侧 TOC（滚动定位）、版本卡（当前版本+可展开历史）。打开详情 MUST 上报一次浏览计数。

#### Scenario: 浏览技能文件
- **WHEN** 用户在文件树点击 `references/workflow.md`
- **THEN** 右侧渲染该文件的 Markdown 内容并显示文件名与大小

#### Scenario: 详情页发布评论
- **WHEN** 登录用户在评论框输入内容并发布
- **THEN** 评论出现在列表顶部，评论计数 +1

### Requirement: 预览弹窗
信息流与搜索结果 SHALL 支持轻量预览弹窗：展示标题/分类/来源/作者/描述/引语、热度分解条形图（传播/收藏/评论/查询各自数值与占比）、安装命令复制、安装/收藏按钮与"完整详情"入口；ESC 或点击遮罩关闭。

#### Scenario: 查看热度分解
- **WHEN** 用户点击卡片"预览"
- **THEN** 弹窗展示该技能四项互动的数值与比例条

### Requirement: 合辑页
合辑页 SHALL 以卡片网格展示合辑：名称、技能数、描述、策展人、总热度、"装齐整套"（复制整套安装脚本或触发 Deep Link）与可展开的技能清单（点击进入详情）。

#### Scenario: 展开合辑清单
- **WHEN** 用户点击"查看清单"
- **THEN** 卡片内展开该合辑全部技能行，按钮变为"收起"

### Requirement: 文档站
Web 端 SHALL 提供文档区（左侧导航 + 内容），至少含四篇：生态概览（Web/CLI/桌面三入口与闭环）、CLI 工具（安装、命令示例、CI 集成）、桌面客户端（服务侧/本地侧能力、SSOT 存储机制、支持的 Agent 列表、Deep Link、备份回退）、Skill 规范（目录结构、frontmatter、按需加载）。

#### Scenario: 文档导航切换
- **WHEN** 用户点击文档导航"Skill 规范"
- **THEN** 内容区显示规范文档且导航项高亮

### Requirement: 个人中心
个人中心 SHALL 展示资料卡（头像、昵称、@handle、角色徽章、简介、编辑入口）与统计（发布数/收藏数/累计传播/最高热度），并提供"我发布的"“我收藏的"列表 tab（空态含引导文案）。资料编辑 MUST 支持 AI 生成昵称+描述候选。

#### Scenario: 查看我收藏的
- **WHEN** 用户切到"我收藏的"tab
- **THEN** 列出其点赞过的技能，含传播/收藏/评论计数与热度

### Requirement: 安装入口与桌面唤起
详情页与卡片的"安装"操作 SHALL 优先尝试 `ripple://install?skill=<slug>` Deep Link 唤起桌面客户端；未安装桌面客户端（唤起失败/超时）时回退为复制 CLI 安装命令并以 toast 告知。

#### Scenario: 无桌面客户端时的回退
- **WHEN** 用户点击"安装"且系统未注册 ripple:// 协议
- **THEN** 页面复制 `ripple install <slug>` 命令并提示在终端运行

### Requirement: 实时通知与涟漪揭示
Web 端 SHALL 维持 SSE 长连接（断线 5 秒自动重连）：收到 `ripple` 通知显示吐司并可打开涟漪揭示弹窗（consume 投递）；收到 `skill_update` 通知提示已下载技能有更新。游客会话 MUST 以持久化 UUID 维持并周期 touch。

#### Scenario: 收到 ripple 推送
- **WHEN** 用户在线且被抽中为某 ripple 的目标
- **THEN** 页面出现涟漪通知吐司，点开揭示弹窗后该投递被标记 consumed

### Requirement: 管理后台页面
Web 端 SHALL 保留 admin 专区（非 admin 访问自动跳回首页）：总览统计、技能管理表（搜索/状态修改/灰度渠道标识）、用户管理表（搜索/启停）。

#### Scenario: 非 admin 访问后台
- **WHEN** 普通用户直接访问 /admin
- **THEN** 被重定向回首页
