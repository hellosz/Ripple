import { z } from 'zod';

export const genderSchema = z.enum(['male', 'female', 'secret']);
export type Gender = z.infer<typeof genderSchema>;

export const userBriefSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string().nullable(),
  avatar_url: z.string().nullable(),
  email: z.string(),
});
export type UserBrief = z.infer<typeof userBriefSchema>;

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  nickname: z.string().nullable(),
  description: z.string().nullable(),
  gender: genderSchema.nullable(),
  zodiac: z.string().nullable(),
  avatar_url: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  role: z.enum(['user', 'admin']),
  status: z.enum(['active', 'disabled']),
  created_at: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const updateProfileInputSchema = z.object({
  nickname: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  gender: genderSchema.optional(),
  zodiac: z.string().max(20).optional(),
  tags: z.array(z.string().min(1).max(30)).max(20).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

export const profileCandidateSchema = z.object({
  nickname: z.string(),
  description: z.string(),
});
export type ProfileCandidate = z.infer<typeof profileCandidateSchema>;

export const generateProfileResponseSchema = z.object({
  candidates: z.array(profileCandidateSchema),
  source: z.enum(['llm', 'fallback']),
});
export type GenerateProfileResponse = z.infer<typeof generateProfileResponseSchema>;
