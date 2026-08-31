import { z } from 'zod';
import { skillListItemSchema } from './skill.js';

export const collectionSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  curator: z.string(),
  gradient: z.string().nullable(),
  skill_count: z.number().int().nonnegative(),
  total_heat: z.number().int().nonnegative(),
  skills: z.array(skillListItemSchema),
  created_at: z.string(),
});
export type Collection = z.infer<typeof collectionSchema>;

export const upsertCollectionInputSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  curator: z.string().min(1).max(50),
  gradient: z.string().max(200).optional(),
  /** 有序技能 slug 列表 */
  skill_names: z.array(z.string()).min(1),
});
export type UpsertCollectionInput = z.infer<typeof upsertCollectionInputSchema>;
