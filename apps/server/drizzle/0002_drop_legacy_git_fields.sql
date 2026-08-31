-- 清理遗留死字段（Git 存储时代）
ALTER TABLE skills DROP COLUMN IF EXISTS git_path;
ALTER TABLE skill_versions DROP COLUMN IF EXISTS git_commit_sha;
