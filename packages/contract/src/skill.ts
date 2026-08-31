import { z } from 'zod';
import {
  originTypeSchema,
  publishChannelSchema,
  ratingSchema,
  sizeTierSchema,
  skillStatusSchema,
} from './common.js';
import { userBriefSchema } from './user.js';

/** 热度分解：传播×1 + 收藏×2 + 评论×4 + 查询×0.05，按周归一化为 0–100 */
export const heatBreakdownSchema = z.object({
  spread: z.number().int().nonnegative(),
  favorites: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  views: z.number().int().nonnegative(),
  heat_raw: z.number().nonnegative(),
  heat: z.number().int().min(0).max(100),
});
export type HeatBreakdown = z.infer<typeof heatBreakdownSchema>;

export const skillStatsSchema = z.object({
  copy_count: z.number().int().nonnegative(),
  like_count: z.number().int().nonnegative(),
  download_count: z.number().int().nonnegative(),
  ripple_count: z.number().int().nonnegative(),
  ripple_reach: z.number().int().nonnegative(),
  view_count: z.number().int().nonnegative(),
  comment_count: z.number().int().nonnegative(),
  heat: z.number().int().min(0).max(100),
  copy_size_tier: sizeTierSchema,
  like_size_tier: sizeTierSchema,
  download_size_tier: sizeTierSchema,
  ripple_size_tier: sizeTierSchema,
});
export type SkillStats = z.infer<typeof skillStatsSchema>;

export const engagementStateSchema = z.object({
  copied_at: z.string().nullable(),
  liked_at: z.string().nullable(),
  downloaded_at: z.string().nullable(),
  rippled_at: z.string().nullable(),
  ripple_available: z.boolean(),
});
export type EngagementState = z.infer<typeof engagementStateSchema>;

export const skillListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  display_name: z.string(),
  description: z.string(),
  category: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  rating: ratingSchema,
  origin_type: originTypeSchema,
  status: skillStatusSchema,
  publish_channel: publishChannelSchema,
  version: z.string(),
  recommendation: z.string().nullable(),
  install_command: z.string(),
  download_url: z.string(),
  author: userBriefSchema,
  stats: skillStatsSchema,
  engagement_state: engagementStateSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type SkillListItem = z.infer<typeof skillListItemSchema>;

export const skillVersionSchema = z.object({
  id: z.string().uuid(),
  version: z.string(),
  changelog: z.string().nullable(),
  rating: ratingSchema.nullable(),
  created_at: z.string(),
});
export type SkillVersion = z.infer<typeof skillVersionSchema>;

export const skillDetailSchema = skillListItemSchema.extend({
  content: z.string().nullable(),
  versions: z.array(skillVersionSchema),
});
export type SkillDetail = z.infer<typeof skillDetailSchema>;

export const skillSortSchema = z.enum([
  'recommended',
  'heat',
  'latest',
  'following',
  // 兼容旧 CLI/前端
  'updated_at',
  'created_at',
]);
export type SkillSort = z.infer<typeof skillSortSchema>;

export const skillListQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  /** 逗号分隔 */
  tags: z.string().optional(),
  rating: ratingSchema.optional(),
  origin_type: originTypeSchema.optional(),
  author: z.string().uuid().optional(),
  sort_by: skillSortSchema.default('recommended'),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(20),
});
export type SkillListQuery = z.infer<typeof skillListQuerySchema>;

// ---- 文件浏览 ----

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeNode[];
}

export const fileTreeNodeSchema: z.ZodType<FileTreeNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    type: z.enum(['file', 'directory']),
    size: z.number().int().nonnegative().optional(),
    children: z.array(fileTreeNodeSchema).optional(),
  }),
);

export const fileContentSchema = z.object({
  path: z.string(),
  name: z.string(),
  content: z.string(),
  language: z.string().nullable(),
  size: z.number().int().nonnegative(),
});
export type FileContent = z.infer<typeof fileContentSchema>;

// ---- 上传 ----

export const skillUploadFormSchema = z.object({
  category: z.string().min(1),
  recommendation: z.string().min(1),
  origin_type: originTypeSchema.default('original'),
  tags: z.string().optional(),
  publish_channel: publishChannelSchema.default('production'),
});
export type SkillUploadForm = z.infer<typeof skillUploadFormSchema>;

export const skillUploadResultSchema = z.object({
  skill: skillDetailSchema,
  rating: ratingSchema,
  suggestions: z.array(z.string()),
  install_command: z.string(),
  download_url: z.string(),
});
export type SkillUploadResult = z.infer<typeof skillUploadResultSchema>;

export const updateSkillStatusInputSchema = z.object({
  status: skillStatusSchema,
});
export type UpdateSkillStatusInput = z.infer<typeof updateSkillStatusInputSchema>;
