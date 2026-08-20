import { z } from 'zod';
import { userBriefSchema } from './user.js';

export const followResponseSchema = z.object({
  following: z.boolean(),
  followee: userBriefSchema,
});
export type FollowResponse = z.infer<typeof followResponseSchema>;

export const followListResponseSchema = z.object({
  items: z.array(userBriefSchema),
  total: z.number().int().nonnegative(),
});
export type FollowListResponse = z.infer<typeof followListResponseSchema>;
