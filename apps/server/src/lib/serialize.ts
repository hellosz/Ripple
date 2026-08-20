import type {
  EngagementState,
  SizeTier,
  SkillListItem,
  SkillStats,
  User,
  UserBrief,
} from '@ripple/contract';
import { normalizeHeat } from '@ripple/contract';
import type { DbUser } from '../plugins/auth.js';
import type { skills } from '../db/schema.js';

export type SkillRow = typeof skills.$inferSelect;

export interface SkillCounts {
  copy_count: number;
  like_count: number;
  download_count: number;
  ripple_count: number;
  ripple_reach: number;
  view_count: number;
  comment_count: number;
  heat_raw_weekly: number;
}

export interface EngagementRow {
  copied_at: Date | null;
  liked_at: Date | null;
  downloaded_at: Date | null;
  rippled_at: Date | null;
}

export function sizeTier(count: number): SizeTier {
  if (count <= 0) return 'default';
  if (count <= 10) return 'small';
  if (count <= 50) return 'medium';
  if (count <= 200) return 'large';
  return 'xlarge';
}

export function toUserBrief(user: {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  email: string;
}): UserBrief {
  return {
    id: user.id,
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    email: user.email,
  };
}

export function toUser(user: DbUser): User {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    description: user.description,
    gender: user.gender,
    zodiac: user.zodiac,
    avatar_url: user.avatar_url,
    tags: user.tags ?? null,
    role: user.role,
    status: user.status,
    created_at: user.created_at.toISOString(),
  };
}

export function toStats(counts: SkillCounts, weeklyMax: number): SkillStats {
  return {
    copy_count: counts.copy_count,
    like_count: counts.like_count,
    download_count: counts.download_count,
    ripple_count: counts.ripple_count,
    ripple_reach: counts.ripple_reach,
    view_count: counts.view_count,
    comment_count: counts.comment_count,
    heat: normalizeHeat(counts.heat_raw_weekly, weeklyMax),
    copy_size_tier: sizeTier(counts.copy_count),
    like_size_tier: sizeTier(counts.like_count),
    download_size_tier: sizeTier(counts.download_count),
    ripple_size_tier: sizeTier(counts.ripple_count),
  };
}

export function toEngagement(row: EngagementRow | null): EngagementState {
  const copied = row?.copied_at ?? null;
  const liked = row?.liked_at ?? null;
  const downloaded = row?.downloaded_at ?? null;
  const rippled = row?.rippled_at ?? null;
  return {
    copied_at: copied ? copied.toISOString() : null,
    liked_at: liked ? liked.toISOString() : null,
    downloaded_at: downloaded ? downloaded.toISOString() : null,
    rippled_at: rippled ? rippled.toISOString() : null,
    ripple_available: Boolean(copied && liked && !rippled),
  };
}

export function toSkillListItem(
  row: SkillRow,
  author: UserBrief,
  counts: SkillCounts,
  engagement: EngagementRow | null,
  weeklyMax: number,
  baseUrl: string,
): SkillListItem {
  return {
    id: row.id,
    name: row.name,
    display_name: row.display_name,
    description: row.description,
    category: row.category,
    tags: row.tags ?? null,
    rating: row.rating,
    origin_type: row.origin_type,
    status: row.status,
    publish_channel: row.publish_channel,
    version: row.version,
    recommendation: row.recommendation,
    install_command: row.install_command ?? `ripple install ${row.name}`,
    download_url: `${baseUrl}/api/skills/${row.name}/download`,
    author,
    stats: toStats(counts, weeklyMax),
    engagement_state: toEngagement(engagement),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
