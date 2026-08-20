ALTER TABLE skills ADD COLUMN IF NOT EXISTS git_path varchar(500);
ALTER TABLE skill_versions ADD COLUMN IF NOT EXISTS git_commit_sha varchar(40);
