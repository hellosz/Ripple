-- Baseline：与旧 Alembic head (20260316_0005) 等价的 schema。
-- 对既有数据库执行 `pnpm db:stamp-baseline` 仅记账不执行；全新数据库正常执行。
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE genderenum AS ENUM ('male', 'female', 'secret');
CREATE TYPE roleenum AS ENUM ('user', 'admin');
CREATE TYPE userstatusenum AS ENUM ('active', 'disabled');
CREATE TYPE origintypeenum AS ENUM ('original', 'derivative', 'repost');
CREATE TYPE ratingenum AS ENUM ('S', 'A', 'B', 'C');
CREATE TYPE skillstatusenum AS ENUM ('active', 'hidden', 'offline', 'disabled');
CREATE TYPE publishchannelenum AS ENUM ('production', 'gray');
CREATE TYPE pushstatusenum AS ENUM ('pending', 'shown', 'consumed', 'dismissed');

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(255) NOT NULL,
    password_hash varchar(255) NOT NULL,
    nickname varchar(50),
    description varchar(200),
    gender genderenum,
    zodiac varchar(20),
    avatar_url varchar(500),
    tags jsonb,
    role roleenum NOT NULL DEFAULT 'user',
    status userstatusenum NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    display_name varchar(200) NOT NULL,
    description text NOT NULL,
    author_id uuid NOT NULL REFERENCES users(id),
    recommendation text,
    origin_type origintypeenum NOT NULL DEFAULT 'original',
    rating ratingenum NOT NULL DEFAULT 'C',
    version varchar(20) NOT NULL DEFAULT '1.0.0',
    tags jsonb,
    category varchar(50),
    install_command varchar(500),
    package_file_name varchar(255),
    package_storage_path varchar(500),
    package_checksum varchar(64),
    git_path varchar(500),
    status skillstatusenum NOT NULL DEFAULT 'active',
    publish_channel publishchannelenum NOT NULL DEFAULT 'production',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ix_skills_name ON skills (name);

CREATE TABLE skill_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id uuid NOT NULL REFERENCES skills(id),
    version varchar(20) NOT NULL,
    changelog text,
    category varchar(50),
    recommendation text,
    origin_type origintypeenum,
    rating ratingenum,
    install_command varchar(500),
    package_file_name varchar(255),
    package_storage_path varchar(500),
    package_checksum varchar(64),
    git_commit_sha varchar(40),
    author_id uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE skill_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id uuid NOT NULL REFERENCES skills(id),
    version varchar(20) NOT NULL,
    path varchar(500) NOT NULL,
    content text NOT NULL,
    language varchar(50),
    size integer NOT NULL DEFAULT 0,
    sha256 varchar(64),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_skill_files_skill_id ON skill_files (skill_id);
CREATE INDEX ix_skill_files_skill_version ON skill_files (skill_id, version);
CREATE INDEX ix_skill_files_path ON skill_files (path);
CREATE INDEX ix_skill_files_content_trgm ON skill_files USING gin (content gin_trgm_ops);

CREATE TABLE user_skill_likes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    skill_id uuid NOT NULL REFERENCES skills(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_skill_like UNIQUE (user_id, skill_id)
);

CREATE TABLE user_skill_downloads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    skill_id uuid NOT NULL REFERENCES skills(id),
    version varchar(20),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_skill_download UNIQUE (user_id, skill_id)
);

CREATE TABLE user_skill_copies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    skill_id uuid NOT NULL REFERENCES skills(id),
    command varchar(500),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_skill_copy UNIQUE (user_id, skill_id)
);

CREATE TABLE ripples (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id uuid NOT NULL REFERENCES skills(id),
    sender_id uuid NOT NULL REFERENCES users(id),
    sender_nickname varchar(50),
    comment varchar(500),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_sender_skill_ripple UNIQUE (sender_id, skill_id)
);

CREATE TABLE guest_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_key varchar(64) NOT NULL,
    claimed_user_id uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ix_guest_sessions_session_key ON guest_sessions (session_key);

CREATE TABLE ripple_pushes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ripple_id uuid NOT NULL REFERENCES ripples(id),
    target_user_id uuid REFERENCES users(id),
    guest_session_id uuid REFERENCES guest_sessions(id),
    status pushstatusenum NOT NULL DEFAULT 'pending',
    shown_at timestamptz,
    consumed_at timestamptz
);

CREATE TABLE skill_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id uuid NOT NULL REFERENCES skills(id),
    author_id uuid NOT NULL REFERENCES users(id),
    parent_id uuid REFERENCES skill_comments(id),
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_skill_comments_skill_id ON skill_comments (skill_id);
CREATE INDEX ix_skill_comments_author_id ON skill_comments (author_id);
