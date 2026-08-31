-- ripple-ts-rewrite：浏览计数、合辑、关注
CREATE TABLE skill_views (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id uuid NOT NULL REFERENCES skills(id),
    user_id uuid REFERENCES users(id),
    guest_session_key varchar(64),
    view_date varchar(10) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_skill_view_user_day ON skill_views (skill_id, user_id, view_date) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX uq_skill_view_guest_day ON skill_views (skill_id, guest_session_key, view_date) WHERE guest_session_key IS NOT NULL;
CREATE INDEX ix_skill_views_skill_id ON skill_views (skill_id);

CREATE TABLE collections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(50) NOT NULL,
    name varchar(100) NOT NULL,
    description varchar(500) NOT NULL DEFAULT '',
    curator varchar(50) NOT NULL DEFAULT '',
    gradient varchar(200),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ix_collections_slug ON collections (slug);

CREATE TABLE collection_skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    position integer NOT NULL DEFAULT 0,
    CONSTRAINT uq_collection_skill UNIQUE (collection_id, skill_id)
);

CREATE TABLE user_follows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_follow UNIQUE (follower_id, followee_id)
);
