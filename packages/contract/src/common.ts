import { z } from 'zod';

export const ratingSchema = z.enum(['S', 'A', 'B', 'C']);
export type Rating = z.infer<typeof ratingSchema>;

export const originTypeSchema = z.enum(['original', 'derivative', 'repost']);
export type OriginType = z.infer<typeof originTypeSchema>;

export const publishChannelSchema = z.enum(['production', 'gray']);
export type PublishChannel = z.infer<typeof publishChannelSchema>;

export const skillStatusSchema = z.enum(['active', 'hidden', 'offline', 'disabled']);
export type SkillStatus = z.infer<typeof skillStatusSchema>;

export const sizeTierSchema = z.enum(['default', 'small', 'medium', 'large', 'xlarge']);
export type SizeTier = z.infer<typeof sizeTierSchema>;

/** 统一业务错误体 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    page_size: z.number().int().positive(),
  });
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
