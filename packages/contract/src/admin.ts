import { z } from 'zod';
import { ratingSchema, skillStatusSchema } from './common.js';
import { skillStatsSchema } from './skill.js';

export const adminUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  nickname: z.string().nullable(),
  role: z.enum(['user', 'admin']),
  status: z.enum(['active', 'disabled']),
  created_at: z.string(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const updateUserStatusInputSchema = z.object({
  status: z.enum(['active', 'disabled']),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusInputSchema>;

export const adminSkillSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  display_name: z.string(),
  rating: ratingSchema,
  status: skillStatusSchema,
  publish_channel: z.enum(['production', 'gray']),
  author_email: z.string(),
  stats: skillStatsSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type AdminSkill = z.infer<typeof adminSkillSchema>;

export const adminStatsSchema = z.object({
  users: z.object({ total: z.number().int().nonnegative() }),
  skills: z.object({
    total: z.number().int().nonnegative(),
    rating_distribution: z.record(z.string(), z.number().int().nonnegative()),
    origin_distribution: z.record(z.string(), z.number().int().nonnegative()),
  }),
  interactions: z.object({
    total_likes: z.number().int().nonnegative(),
    total_downloads: z.number().int().nonnegative(),
    total_ripples: z.number().int().nonnegative(),
  }),
});
export type AdminStats = z.infer<typeof adminStatsSchema>;

const topEntrySchema = z.object({
  name: z.string(),
  display_name: z.string(),
  count: z.number().int().nonnegative(),
});

export const topStatsSchema = z.object({
  top_downloads: z.array(topEntrySchema),
  top_likes: z.array(topEntrySchema),
  top_ripples: z.array(topEntrySchema),
});
export type TopStats = z.infer<typeof topStatsSchema>;
