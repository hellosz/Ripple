import { z } from 'zod';
import { userBriefSchema, type UserBrief } from './user.js';

export interface SkillComment {
  id: string;
  skill_id: string;
  parent_id: string | null;
  content: string;
  author: UserBrief;
  children: SkillComment[];
  created_at: string;
  updated_at: string;
}

export const skillCommentSchema: z.ZodType<SkillComment> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    skill_id: z.string().uuid(),
    parent_id: z.string().uuid().nullable(),
    content: z.string(),
    author: userBriefSchema,
    children: z.array(skillCommentSchema),
    created_at: z.string(),
    updated_at: z.string(),
  }),
);

export const createCommentInputSchema = z.object({
  content: z.string().min(1).max(2000),
  parent_id: z.string().uuid().optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;
