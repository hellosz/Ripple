import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// PG enum 类型名与 SQLAlchemy 默认命名保持一致（小写类名）
export const genderEnum = pgEnum('genderenum', ['male', 'female', 'secret']);
export const roleEnum = pgEnum('roleenum', ['user', 'admin']);
export const userStatusEnum = pgEnum('userstatusenum', ['active', 'disabled']);
export const originTypeEnum = pgEnum('origintypeenum', ['original', 'derivative', 'repost']);
export const ratingEnum = pgEnum('ratingenum', ['S', 'A', 'B', 'C']);
export const skillStatusEnum = pgEnum('skillstatusenum', ['active', 'hidden', 'offline', 'disabled']);
export const publishChannelEnum = pgEnum('publishchannelenum', ['production', 'gray']);
export const pushStatusEnum = pgEnum('pushstatusenum', ['pending', 'shown', 'consumed', 'dismissed']);

const uuidPk = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  'users',
  {
    id: uuidPk(),
    email: varchar('email', { length: 255 }).notNull(),
    password_hash: varchar('password_hash', { length: 255 }).notNull(),
    nickname: varchar('nickname', { length: 50 }),
    description: varchar('description', { length: 200 }),
    gender: genderEnum('gender'),
    zodiac: varchar('zodiac', { length: 20 }),
    avatar_url: varchar('avatar_url', { length: 500 }),
    tags: jsonb('tags').$type<string[]>(),
    role: roleEnum('role').notNull().default('user'),
    status: userStatusEnum('status').notNull().default('active'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [uniqueIndex('ix_users_email').on(t.email)],
);

export const skills = pgTable(
  'skills',
  {
    id: uuidPk(),
    name: varchar('name', { length: 100 }).notNull(),
    display_name: varchar('display_name', { length: 200 }).notNull(),
    description: text('description').notNull(),
    author_id: uuid('author_id')
      .notNull()
      .references(() => users.id),
    recommendation: text('recommendation'),
    origin_type: originTypeEnum('origin_type').notNull().default('original'),
    rating: ratingEnum('rating').notNull().default('C'),
    version: varchar('version', { length: 20 }).notNull().default('1.0.0'),
    tags: jsonb('tags').$type<string[]>(),
    category: varchar('category', { length: 50 }),
    install_command: varchar('install_command', { length: 500 }),
    package_file_name: varchar('package_file_name', { length: 255 }),
    package_storage_path: varchar('package_storage_path', { length: 500 }),
    package_checksum: varchar('package_checksum', { length: 64 }),
    status: skillStatusEnum('status').notNull().default('active'),
    publish_channel: publishChannelEnum('publish_channel').notNull().default('production'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [uniqueIndex('ix_skills_name').on(t.name)],
);

export const skillVersions = pgTable('skill_versions', {
  id: uuidPk(),
  skill_id: uuid('skill_id')
    .notNull()
    .references(() => skills.id),
  version: varchar('version', { length: 20 }).notNull(),
  changelog: text('changelog'),
  category: varchar('category', { length: 50 }),
  recommendation: text('recommendation'),
  origin_type: originTypeEnum('origin_type'),
  rating: ratingEnum('rating'),
  install_command: varchar('install_command', { length: 500 }),
  package_file_name: varchar('package_file_name', { length: 255 }),
  package_storage_path: varchar('package_storage_path', { length: 500 }),
  package_checksum: varchar('package_checksum', { length: 64 }),
  author_id: uuid('author_id')
    .notNull()
    .references(() => users.id),
  created_at: createdAt(),
});

export const skillFiles = pgTable(
  'skill_files',
  {
    id: uuidPk(),
    skill_id: uuid('skill_id')
      .notNull()
      .references(() => skills.id),
    version: varchar('version', { length: 20 }).notNull(),
    path: varchar('path', { length: 500 }).notNull(),
    content: text('content').notNull(),
    language: varchar('language', { length: 50 }),
    size: integer('size').notNull().default(0),
    sha256: varchar('sha256', { length: 64 }),
    created_at: createdAt(),
  },
  (t) => [
    index('ix_skill_files_skill_id').on(t.skill_id),
    index('ix_skill_files_skill_version').on(t.skill_id, t.version),
    index('ix_skill_files_path').on(t.path),
  ],
);

export const userSkillLikes = pgTable(
  'user_skill_likes',
  {
    id: uuidPk(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    skill_id: uuid('skill_id')
      .notNull()
      .references(() => skills.id),
    created_at: createdAt(),
  },
  (t) => [uniqueIndex('uq_user_skill_like').on(t.user_id, t.skill_id)],
);

export const userSkillDownloads = pgTable(
  'user_skill_downloads',
  {
    id: uuidPk(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    skill_id: uuid('skill_id')
      .notNull()
      .references(() => skills.id),
    version: varchar('version', { length: 20 }),
    created_at: createdAt(),
  },
  (t) => [uniqueIndex('uq_user_skill_download').on(t.user_id, t.skill_id)],
);

export const userSkillCopies = pgTable(
  'user_skill_copies',
  {
    id: uuidPk(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    skill_id: uuid('skill_id')
      .notNull()
      .references(() => skills.id),
    command: varchar('command', { length: 500 }),
    created_at: createdAt(),
  },
  (t) => [uniqueIndex('uq_user_skill_copy').on(t.user_id, t.skill_id)],
);

export const ripples = pgTable(
  'ripples',
  {
    id: uuidPk(),
    skill_id: uuid('skill_id')
      .notNull()
      .references(() => skills.id),
    sender_id: uuid('sender_id')
      .notNull()
      .references(() => users.id),
    sender_nickname: varchar('sender_nickname', { length: 50 }),
    comment: varchar('comment', { length: 500 }),
    created_at: createdAt(),
  },
  (t) => [uniqueIndex('uq_sender_skill_ripple').on(t.sender_id, t.skill_id)],
);

export const guestSessions = pgTable(
  'guest_sessions',
  {
    id: uuidPk(),
    session_key: varchar('session_key', { length: 64 }).notNull(),
    claimed_user_id: uuid('claimed_user_id').references(() => users.id),
    created_at: createdAt(),
    last_seen_at: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('ix_guest_sessions_session_key').on(t.session_key)],
);

export const ripplePushes = pgTable('ripple_pushes', {
  id: uuidPk(),
  ripple_id: uuid('ripple_id')
    .notNull()
    .references(() => ripples.id),
  target_user_id: uuid('target_user_id').references(() => users.id),
  guest_session_id: uuid('guest_session_id').references(() => guestSessions.id),
  status: pushStatusEnum('status').notNull().default('pending'),
  shown_at: timestamp('shown_at', { withTimezone: true }),
  consumed_at: timestamp('consumed_at', { withTimezone: true }),
});

export const skillComments = pgTable(
  'skill_comments',
  {
    id: uuidPk(),
    skill_id: uuid('skill_id')
      .notNull()
      .references(() => skills.id),
    author_id: uuid('author_id')
      .notNull()
      .references(() => users.id),
    parent_id: uuid('parent_id'),
    content: text('content').notNull(),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    index('ix_skill_comments_skill_id').on(t.skill_id),
    index('ix_skill_comments_author_id').on(t.author_id),
  ],
);

// ---- ripple-ts-rewrite 新增表 ----

/** 浏览（查询）计数：同一主体同一技能每日至多 1 次 */
export const skillViews = pgTable(
  'skill_views',
  {
    id: uuidPk(),
    skill_id: uuid('skill_id')
      .notNull()
      .references(() => skills.id),
    user_id: uuid('user_id').references(() => users.id),
    guest_session_key: varchar('guest_session_key', { length: 64 }),
    view_date: varchar('view_date', { length: 10 }).notNull(),
    created_at: createdAt(),
  },
  (t) => [
    uniqueIndex('uq_skill_view_user_day').on(t.skill_id, t.user_id, t.view_date),
    uniqueIndex('uq_skill_view_guest_day').on(t.skill_id, t.guest_session_key, t.view_date),
    index('ix_skill_views_skill_id').on(t.skill_id),
  ],
);

export const collections = pgTable(
  'collections',
  {
    id: uuidPk(),
    slug: varchar('slug', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 500 }).notNull().default(''),
    curator: varchar('curator', { length: 50 }).notNull().default(''),
    gradient: varchar('gradient', { length: 200 }),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [uniqueIndex('ix_collections_slug').on(t.slug)],
);

export const collectionSkills = pgTable(
  'collection_skills',
  {
    id: uuidPk(),
    collection_id: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    skill_id: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (t) => [uniqueIndex('uq_collection_skill').on(t.collection_id, t.skill_id)],
);

export const userFollows = pgTable(
  'user_follows',
  {
    id: uuidPk(),
    follower_id: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followee_id: uuid('followee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    created_at: createdAt(),
  },
  (t) => [uniqueIndex('uq_user_follow').on(t.follower_id, t.followee_id)],
);

/** 设备码流程无库表（Redis）；此表用于自研迁移器记账 */
export const rippleMigrations = pgTable('ripple_migrations', {
  name: varchar('name', { length: 255 }).primaryKey(),
  applied_at: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
  stamped: boolean('stamped').notNull().default(false),
});
