export interface User {
  id: string;
  email: string;
  nickname: string | null;
  description: string | null;
  gender: "male" | "female" | "secret" | null;
  zodiac: string | null;
  avatar_url: string | null;
  tags: string[] | null;
  role: "user" | "admin";
  status: "active" | "disabled";
  created_at: string;
}

export interface UserBrief {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  email: string;
}

export interface SkillStats {
  like_count: number;
  download_count: number;
  ripple_count: number;
  ripple_reach: number;
  like_size_tier: SizeTier;
  download_size_tier: SizeTier;
  ripple_size_tier: SizeTier;
}

export type SizeTier = "default" | "small" | "medium" | "large" | "xlarge";

export interface SkillListItem {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string | null;
  tags: string[] | null;
  rating: Rating;
  origin_type: OriginType;
  version: string;
  recommendation: string | null;
  author: UserBrief;
  stats: SkillStats;
  user_liked: boolean;
  user_downloaded: boolean;
  user_rippled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SkillDetail extends SkillListItem {
  recommendation: string | null;
  content: string | null;
  versions: SkillVersion[];
}

export interface SkillVersion {
  id: string;
  version: string;
  changelog: string | null;
  rating: Rating | null;
  created_at: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
  size?: number;
}

export interface FileContent {
  path: string;
  name: string;
  content: string;
  language: string | null;
  is_binary: boolean;
}

export type Rating = "S" | "A" | "B" | "C";
export type OriginType = "original" | "derivative" | "repost";

export interface RipplePush {
  id: string;
  target_user: UserBrief;
  status: "pending" | "delivered" | "viewed" | "dismissed";
  delivered_at: string | null;
  viewed_at: string | null;
}

export interface RippleRecord {
  id: string;
  skill_id: string;
  skill_name: string;
  skill_display_name: string;
  sender: UserBrief;
  pushes: RipplePush[];
  created_at: string;
}

export interface RippleNotification {
  type: "ripple";
  ripple_id: string;
  skill_name: string;
  skill_slug: string;
  sender: UserBrief;
  comment?: string;
}

export interface UpdateNotification {
  type: "skill_update";
  skill_name: string;
  skill_slug: string;
  new_version: string;
  changelog?: string;
}

export type Notification = RippleNotification | UpdateNotification;

export interface ProfileCandidate {
  nickname: string;
  description: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminStats {
  users: {
    total: number;
  };
  skills: {
    total: number;
    rating_distribution: Record<string, number>;
    origin_distribution: Record<string, number>;
  };
  interactions: {
    total_likes: number;
    total_downloads: number;
    total_ripples: number;
  };
}

export interface TopStats {
  top_downloads: { name: string; display_name: string; count: number }[];
  top_likes: { name: string; display_name: string; count: number }[];
  top_ripples: { name: string; display_name: string; count: number }[];
}
