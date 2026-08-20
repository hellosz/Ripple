# server-api

## ADDED Requirements

### Requirement: 邮箱注册与 JWT 登录
系统 SHALL 提供邮箱注册（随机生成密码并通过邮件下发；邮箱等于 `ADMIN_EMAIL` 时自动授予 admin 角色）与 email+password 登录，登录成功返回 HS256 JWT（默认 7 天有效期）。注册与登录时若请求携带 `X-Ripple-Guest-Session` 头，系统 MUST 将该游客会话的待投递 ripple 认领到该用户。被禁用（disabled）用户 MUST 被拒绝访问需登录的接口。

#### Scenario: 注册并认领游客投递
- **WHEN** 携带有效 `X-Ripple-Guest-Session` 头的匿名用户用新邮箱注册
- **THEN** 系统创建用户、发送含初始密码的邮件，并把该游客会话的 pending 投递转为该用户的投递

#### Scenario: 禁用用户登录后访问
- **WHEN** status 为 disabled 的用户携带有效 JWT 访问需登录接口
- **THEN** 系统返回 403

### Requirement: OAuth 设备码授权流程
系统 SHALL 实现设备码流程供 CLI 登录：`POST /api/auth/device/init` 返回 device_code、user_code（去混淆字母表 `XXXX-XXXX` 格式）、验证 URL、过期时间与轮询间隔；已登录用户在浏览器 `POST /api/auth/device/confirm` 确认 user_code 后，CLI 通过 `GET /api/auth/device/poll` 一次性获取 access_token。设备码状态 MUST 存于 Redis 且 TTL 为 10 分钟，token 被消费后立即失效。

#### Scenario: 完整设备码授权
- **WHEN** CLI 发起 device/init，用户在浏览器确认 user_code，CLI 轮询 device/poll
- **THEN** 首次轮询到 authorized 状态时返回 access_token，再次轮询同一 device_code 返回错误

#### Scenario: 设备码过期
- **WHEN** device_code 超过 10 分钟未被确认
- **THEN** poll 返回过期错误，CLI 需重新发起流程

### Requirement: 技能列表与搜索
系统 SHALL 提供技能列表接口，支持 search（匹配 name/display_name/description 及 `skill_files` 正文全文搜索）、category、tags、rating、origin_type、author、sort_by（热度/最新/最早/更新时间）与分页参数。tags 过滤 MUST 实际生效（修复现有缺口）。列表 MUST 以聚合查询一次返回作者、当前版本、统计与当前用户互动状态，不产生每行 N+1 查询。非 admin 用户 MUST 只能看到 `publish_channel = production` 且 status 为 active 的技能。

#### Scenario: 正文全文搜索
- **WHEN** 用户以关键词搜索且该词只出现在某技能的 SKILL.md 正文中
- **THEN** 该技能出现在结果中

#### Scenario: tags 过滤生效
- **WHEN** 请求带 `tags=git`
- **THEN** 仅返回 tags 含 "git" 的技能

#### Scenario: 灰度技能对普通用户隐藏
- **WHEN** 普通用户请求列表且存在 publish_channel=gray 的技能
- **THEN** 灰度技能不出现在结果中；admin 用户请求时可见

### Requirement: 技能详情、文件与版本
系统 SHALL 提供技能详情（含 SKILL.md 正文、统计、版本列表、当前用户互动状态）、当前版本文件树、单文件内容（含 language 标记）与版本历史接口。

#### Scenario: 浏览文件树与文件内容
- **WHEN** 请求 `GET /api/skills/{slug}/files` 及某个文件路径
- **THEN** 返回按目录层级重建的文件树，以及该文件的文本内容与语言标记

### Requirement: 技能上传、校验与版本发布
系统 SHALL 接受 multipart ZIP 上传（≤10MB），按 `skill-package-spec` 能力校验并评级；校验通过后原包以内容寻址 key `{name}/{version}/{sha256}.zip` 存入对象存储（MinIO/S3 兼容），文本文件写入 `skill_files`（先删同版本旧记录），并创建 `skill_versions` 版本记录。同名技能属于他人时 MUST 拒绝；属于本人时按新版本更新。上传成功响应 MUST 包含 install_command、rating 与改进建议。技能更新成功后系统 MUST 向下载过该技能的在线用户推送 `skill_update` SSE 通知。

#### Scenario: 新技能上传成功
- **WHEN** 具备发布权限的用户上传合法 ZIP
- **THEN** 系统入库并返回 rating 与 install_command，原包可从对象存储取回

#### Scenario: 冒名更新他人技能被拒
- **WHEN** 用户上传的包 frontmatter name 与他人已有技能同名
- **THEN** 系统拒绝并返回冲突错误

### Requirement: 技能 ZIP 下载
系统 SHALL 提供 ZIP 下载端点：优先返回对象存储中的原包，原包缺失时从 `skill_files` 现场打包；登录用户下载 MUST 记录到 `user_skill_downloads`。

#### Scenario: 原包缺失时回退打包
- **WHEN** 对象存储中无该版本原包但 `skill_files` 有记录
- **THEN** 系统现场打包 ZIP 返回，响应仍为合法 ZIP 文件

### Requirement: 互动行为（copy/like/ripple）
系统 SHALL 提供复制安装命令（幂等记录）、点赞/取消点赞（重复点赞返回 400）、发起 ripple 三类互动。发起 ripple 的前置条件 MUST 为：当前用户已 copy 且已 like 且未对该技能 ripple 过（`(sender, skill)` 唯一）。互动接口 MUST 返回最新统计与当前用户互动状态。

#### Scenario: 未满足前置条件发起 ripple
- **WHEN** 用户未点赞该技能就调用 ripple 接口
- **THEN** 系统拒绝并说明缺失的前置动作

### Requirement: 热度计算与热度榜
系统 SHALL 按公式 `heat_raw = 传播(ripple)×1 + 收藏(like)×2 + 评论×4 + 查询(view)×0.05` 计算技能热度，并按周窗口归一化为 0–100 整数（`heat = round(100 × heat_raw / max(周内最大 heat_raw, 归一化下限))`）。系统 SHALL 提供热度榜接口（Top N），列表与详情响应 MUST 携带 heat 值。归一化基准 MUST 缓存并至少每小时刷新。

#### Scenario: 热度随互动增长
- **WHEN** 某技能新增一次点赞
- **THEN** 其 heat_raw 增加 2，刷新后热度值不低于此前

### Requirement: 浏览（查询）计数
系统 SHALL 记录技能详情浏览次数（登录用户按 user 去重、游客按 session 去重，同一主体同一技能每日至多计 1 次），作为热度公式中的"查询"项。

#### Scenario: 同一用户当日重复浏览
- **WHEN** 同一用户同日两次打开同一技能详情
- **THEN** 查询计数仅 +1

### Requirement: RP 推送与投递
系统 SHALL 在 ripple 创建时构建收件人候选池（全部 active 用户排除发送者与已点赞者，加上最近 30 分钟活跃且未认领的游客会话），随机抽取 3–7 个目标创建 `ripple_pushes` 投递记录。在线目标 MUST 立即置 shown 并经 SSE 推送；离线目标保持 pending，于下次建立 SSE 连接时补发并置 shown。系统 SHALL 提供投递 consume 与 dismiss 端点，及游客会话 touch 端点（`X-Ripple-Guest-Session` 维持活跃）。游客投递在会话被认领时 MUST 转为用户投递；若该用户已点赞该技能或已有同 ripple 投递则置 dismissed。

#### Scenario: 离线用户上线补发
- **WHEN** 目标用户在投递创建时不在线，随后建立 SSE 连接
- **THEN** 连接建立后收到该 pending 投递通知，记录状态变为 shown

#### Scenario: 投递消费
- **WHEN** 用户对通知点击查看并调用 consume 端点
- **THEN** 投递状态变为 consumed 并记录 consumed_at

### Requirement: SSE 实时通知
系统 SHALL 提供 `GET /api/sse/notifications?token=` 事件流端点（token 经 query 传递），支持 `ripple` 与 `skill_update` 两类事件，30 秒心跳保活；多实例部署时通过 Redis pub/sub（`ripple:sse:{user_id}` 频道）跨实例投递，Redis 不可用时 MUST 降级为本实例内投递。

#### Scenario: 跨实例投递
- **WHEN** 用户连接在实例 A，事件由实例 B 产生
- **THEN** 事件经 Redis pub/sub 到达实例 A 并推送给该用户

### Requirement: 嵌套评论
系统 SHALL 提供技能评论的读取（嵌套树）与发布（支持 parent_id 任意层级回复；发布需登录）。评论数 MUST 计入热度公式。

#### Scenario: 回复评论
- **WHEN** 登录用户携带 parent_id 发布回复
- **THEN** 评论树中该回复嵌套于父评论之下

### Requirement: 合辑（Collections）
系统 SHALL 提供合辑模型与接口：合辑含名称、描述、策展人与有序技能清单；提供合辑列表与详情（含每个技能的安装状态所需数据与合辑总热度）。合辑的创建与维护 MUST 限 admin。

#### Scenario: 读取合辑清单
- **WHEN** 请求合辑列表
- **THEN** 返回各合辑的技能数、策展人、总热度与技能清单

### Requirement: 关注作者
系统 SHALL 支持用户关注/取关作者，并提供"关注"信息流（仅关注作者发布的技能，按时间排序）。

#### Scenario: 关注流过滤
- **WHEN** 用户关注了作者 A 且请求关注流
- **THEN** 结果仅包含 A 发布的技能

### Requirement: 个人中心数据
系统 SHALL 提供当前用户资料读取/更新（nickname/description/gender/zodiac/tags）、AI 生成 6 组昵称+描述候选（未配置 LLM key 时降级为静态模板）、我发布的/我点赞的/我下载的/我发起的 ripple（含投递明细）列表。

#### Scenario: LLM 未配置时生成画像
- **WHEN** 服务端未配置 OPENAI_API_KEY 且用户请求生成画像
- **THEN** 返回本地静态模板的 6 组候选而非报错

### Requirement: 管理后台接口
系统 SHALL 提供 admin 专属接口：用户分页列表与搜索、用户启用/禁用、全量技能列表与状态管理、总览统计（用户数/技能数/评级分布/来源分布/互动计数）与 Top10 榜单（下载/点赞/ripple）。

#### Scenario: 非 admin 访问管理接口
- **WHEN** 普通用户请求 `/api/admin/*`
- **THEN** 系统返回 403

### Requirement: 数据库平滑接管
TS 服务端 MUST 复用现有 PostgreSQL 数据库：baseline 迁移与现有 Alembic head schema 等价，在既有库上仅标记不执行；新增表（浏览计数、合辑、关注）与遗留字段清理（`skills.git_path`、`skill_versions.git_commit_sha`）以独立可回滚迁移交付。

#### Scenario: 对既有库启动
- **WHEN** TS 服务端首次连接由 Python 版本创建的数据库
- **THEN** baseline 被标记为已应用，存量数据完整可读，仅执行新增迁移
