import { z } from 'zod';
import { engagementStateSchema, skillStatsSchema } from './skill.js';

export const statsResponseSchema = z.object({
  stats: skillStatsSchema,
  engagement_state: engagementStateSchema.nullable(),
});
export type StatsResponse = z.infer<typeof statsResponseSchema>;

export const copyResponseSchema = z.object({
  command: z.string(),
  stats: skillStatsSchema,
  engagement_state: engagementStateSchema,
});
export type CopyResponse = z.infer<typeof copyResponseSchema>;

export const likeResponseSchema = z.object({
  stats: skillStatsSchema,
  engagement_state: engagementStateSchema,
});
export type LikeResponse = z.infer<typeof likeResponseSchema>;

export const createRippleInputSchema = z.object({
  comment: z.string().max(500).optional(),
});
export type CreateRippleInput = z.infer<typeof createRippleInputSchema>;

export const createRippleResponseSchema = z.object({
  ripple_id: z.string().uuid(),
  push_count: z.number().int().nonnegative(),
  stats: skillStatsSchema,
  engagement_state: engagementStateSchema,
});
export type CreateRippleResponse = z.infer<typeof createRippleResponseSchema>;

export const viewResponseSchema = z.object({
  counted: z.boolean(),
  view_count: z.number().int().nonnegative(),
});
export type ViewResponse = z.infer<typeof viewResponseSchema>;
