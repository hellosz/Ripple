-- 存量库 parity：SQLAlchemy 时代的默认值在 Python 侧，DB 列缺少 DEFAULT 且部分列可空。
-- 本迁移把存量库补齐到与 baseline 相同的 DB 级语义；在全新库上等价于无操作（幂等）。

-- id 默认值
ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE skills ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE skill_versions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE skill_files ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE user_skill_likes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE user_skill_downloads ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE user_skill_copies ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE ripples ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE guest_sessions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE ripple_pushes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE skill_comments ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- users：角色/状态
UPDATE users SET role = 'user' WHERE role IS NULL;
UPDATE users SET status = 'active' WHERE status IS NULL;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE users ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
ALTER TABLE users ALTER COLUMN status SET NOT NULL;

-- skills：枚举与版本默认
UPDATE skills SET origin_type = 'original' WHERE origin_type IS NULL;
UPDATE skills SET rating = 'C' WHERE rating IS NULL;
UPDATE skills SET version = '1.0.0' WHERE version IS NULL;
UPDATE skills SET status = 'active' WHERE status IS NULL;
UPDATE skills SET publish_channel = 'production' WHERE publish_channel IS NULL;
ALTER TABLE skills ALTER COLUMN origin_type SET DEFAULT 'original';
ALTER TABLE skills ALTER COLUMN rating SET DEFAULT 'C';
ALTER TABLE skills ALTER COLUMN version SET DEFAULT '1.0.0';
ALTER TABLE skills ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE skills ALTER COLUMN publish_channel SET DEFAULT 'production';
ALTER TABLE skills ALTER COLUMN origin_type SET NOT NULL;
ALTER TABLE skills ALTER COLUMN rating SET NOT NULL;
ALTER TABLE skills ALTER COLUMN version SET NOT NULL;
ALTER TABLE skills ALTER COLUMN status SET NOT NULL;
ALTER TABLE skills ALTER COLUMN publish_channel SET NOT NULL;

-- ripple_pushes：投递状态
UPDATE ripple_pushes SET status = 'pending' WHERE status IS NULL;
ALTER TABLE ripple_pushes ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE ripple_pushes ALTER COLUMN status SET NOT NULL;

-- skill_files：大小默认
UPDATE skill_files SET size = 0 WHERE size IS NULL;
ALTER TABLE skill_files ALTER COLUMN size SET DEFAULT 0;
ALTER TABLE skill_files ALTER COLUMN size SET NOT NULL;

-- 时间戳默认（存量库为 Python 侧生成时补齐）
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE skills ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE skills ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE skill_versions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE skill_files ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE user_skill_likes ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE user_skill_downloads ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE user_skill_copies ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE ripples ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE guest_sessions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE guest_sessions ALTER COLUMN last_seen_at SET DEFAULT now();
ALTER TABLE skill_comments ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE skill_comments ALTER COLUMN updated_at SET DEFAULT now();
