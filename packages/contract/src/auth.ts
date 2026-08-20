import { z } from 'zod';
import { userSchema } from './user.js';

export const registerInputSchema = z.object({
  email: z.string().email(),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const tokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal('bearer'),
  user: userSchema,
});
export type TokenResponse = z.infer<typeof tokenResponseSchema>;

export const registerResponseSchema = z.object({
  user: userSchema,
  message: z.string(),
});
export type RegisterResponse = z.infer<typeof registerResponseSchema>;

// ---- OAuth Device Authorization Flow（CLI/桌面登录）----

export const deviceInitResponseSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_url: z.string(),
  expires_in: z.number().int(),
  interval: z.number().int(),
});
export type DeviceInitResponse = z.infer<typeof deviceInitResponseSchema>;

export const devicePollResponseSchema = z.object({
  status: z.enum(['pending', 'authorized', 'expired']),
  access_token: z.string().optional(),
});
export type DevicePollResponse = z.infer<typeof devicePollResponseSchema>;

export const deviceConfirmInputSchema = z.object({
  user_code: z.string().min(1),
});
export type DeviceConfirmInput = z.infer<typeof deviceConfirmInputSchema>;
