import { z } from 'zod';
import { userBriefSchema } from './user.js';

export const pushStatusSchema = z.enum(['pending', 'shown', 'consumed', 'dismissed']);
export type PushStatus = z.infer<typeof pushStatusSchema>;

export const ripplePushSchema = z.object({
  id: z.string().uuid(),
  target_user: userBriefSchema.nullable(),
  status: pushStatusSchema,
  shown_at: z.string().nullable(),
  consumed_at: z.string().nullable(),
});
export type RipplePush = z.infer<typeof ripplePushSchema>;

export const rippleRecordSchema = z.object({
  id: z.string().uuid(),
  skill_id: z.string().uuid(),
  skill_name: z.string(),
  skill_display_name: z.string(),
  sender: userBriefSchema,
  comment: z.string().nullable(),
  pushes: z.array(ripplePushSchema),
  created_at: z.string(),
});
export type RippleRecord = z.infer<typeof rippleRecordSchema>;

// ---- SSE 通知 ----

export const rippleNotificationSchema = z.object({
  type: z.literal('ripple'),
  delivery_id: z.string().uuid(),
  ripple_id: z.string().uuid(),
  skill_name: z.string(),
  skill_display_name: z.string(),
  skill_slug: z.string(),
  sender: userBriefSchema,
  comment: z.string().optional(),
});
export type RippleNotification = z.infer<typeof rippleNotificationSchema>;

export const updateNotificationSchema = z.object({
  type: z.literal('skill_update'),
  skill_name: z.string(),
  skill_display_name: z.string(),
  skill_slug: z.string(),
  new_version: z.string(),
  changelog: z.string().optional(),
});
export type UpdateNotification = z.infer<typeof updateNotificationSchema>;

export const notificationSchema = z.discriminatedUnion('type', [
  rippleNotificationSchema,
  updateNotificationSchema,
]);
export type Notification = z.infer<typeof notificationSchema>;

export const guestTouchResponseSchema = z.object({
  session_key: z.string(),
  active: z.boolean(),
});
export type GuestTouchResponse = z.infer<typeof guestTouchResponseSchema>;
