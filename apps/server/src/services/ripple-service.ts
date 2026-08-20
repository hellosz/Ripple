import { and, eq, gt, isNull, ne, notInArray, sql } from 'drizzle-orm';
import type { Notification } from '@ripple/contract';
import type { Db } from '../db/client.js';
import {
  guestSessions,
  ripplePushes,
  ripples,
  skills,
  userSkillLikes,
  users,
} from '../db/schema.js';
import { toUserBrief } from '../lib/serialize.js';
import type { SseHub } from './sse-hub.js';

export const GUEST_ACTIVE_WINDOW_MINUTES = 30;
export const PUSH_MIN = 3;
export const PUSH_MAX = 7;

export function samplePushCount(candidateCount: number, rand: () => number = Math.random): number {
  const target = PUSH_MIN + Math.floor(rand() * (PUSH_MAX - PUSH_MIN + 1));
  return Math.min(candidateCount, target);
}

export function shuffle<T>(items: T[], rand: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
  }
  return arr;
}

interface Candidate {
  kind: 'user' | 'guest';
  id: string;
}

/** 候选池：active 用户（排除发送者与已点赞者）+ 最近 30 分钟活跃未认领游客 */
export async function buildCandidatePool(
  db: Db,
  senderId: string,
  skillId: string,
): Promise<Candidate[]> {
  const likedUserIds = db
    .select({ id: userSkillLikes.user_id })
    .from(userSkillLikes)
    .where(eq(userSkillLikes.skill_id, skillId));
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.status, 'active'), ne(users.id, senderId), notInArray(users.id, likedUserIds)));
  const guestRows = await db
    .select({ id: guestSessions.id })
    .from(guestSessions)
    .where(
      and(
        isNull(guestSessions.claimed_user_id),
        gt(guestSessions.last_seen_at, sql`now() - interval '${sql.raw(String(GUEST_ACTIVE_WINDOW_MINUTES))} minutes'`),
      ),
    );
  return [
    ...userRows.map((r): Candidate => ({ kind: 'user', id: r.id })),
    ...guestRows.map((r): Candidate => ({ kind: 'guest', id: r.id })),
  ];
}

export interface CreateRippleResult {
  rippleId: string;
  pushCount: number;
}

export async function createRippleWithPushes(
  db: Db,
  hub: SseHub,
  params: { senderId: string; skillId: string; comment: string | null },
): Promise<CreateRippleResult> {
  const senderRows = await db.select().from(users).where(eq(users.id, params.senderId)).limit(1);
  const skillRows = await db.select().from(skills).where(eq(skills.id, params.skillId)).limit(1);
  const sender = senderRows[0];
  const skill = skillRows[0];
  if (!sender || !skill) throw new Error('sender or skill not found');

  const inserted = await db
    .insert(ripples)
    .values({
      skill_id: params.skillId,
      sender_id: params.senderId,
      sender_nickname: sender.nickname,
      comment: params.comment,
    })
    .returning({ id: ripples.id });
  const rippleId = inserted[0]!.id;

  const pool = await buildCandidatePool(db, params.senderId, params.skillId);
  const chosen = shuffle(pool).slice(0, samplePushCount(pool.length));

  let pushCount = 0;
  for (const candidate of chosen) {
    const notificationBase = {
      ripple_id: rippleId,
      skill_name: skill.name,
      skill_display_name: skill.display_name,
      skill_slug: skill.name,
      sender: toUserBrief(sender),
      ...(params.comment ? { comment: params.comment } : {}),
    };
    if (candidate.kind === 'user') {
      const online = hub.isUserOnline(candidate.id);
      const rows = await db
        .insert(ripplePushes)
        .values({
          ripple_id: rippleId,
          target_user_id: candidate.id,
          status: online ? 'shown' : 'pending',
          shown_at: online ? new Date() : null,
        })
        .returning({ id: ripplePushes.id });
      if (online) {
        const notification: Notification = {
          type: 'ripple',
          delivery_id: rows[0]!.id,
          ...notificationBase,
        };
        await hub.notify(candidate.id, notification);
      }
    } else {
      await db.insert(ripplePushes).values({
        ripple_id: rippleId,
        guest_session_id: candidate.id,
        status: 'pending',
      });
    }
    pushCount++;
  }
  return { rippleId, pushCount };
}

/** SSE 连接建立时补发 pending 投递并置 shown */
export async function drainPendingPushes(db: Db, userId: string): Promise<Notification[]> {
  const rows = await db
    .select({
      push: ripplePushes,
      ripple: ripples,
      skill: skills,
      sender: users,
    })
    .from(ripplePushes)
    .innerJoin(ripples, eq(ripplePushes.ripple_id, ripples.id))
    .innerJoin(skills, eq(ripples.skill_id, skills.id))
    .innerJoin(users, eq(ripples.sender_id, users.id))
    .where(and(eq(ripplePushes.target_user_id, userId), eq(ripplePushes.status, 'pending')));
  const notifications: Notification[] = [];
  for (const row of rows) {
    await db
      .update(ripplePushes)
      .set({ status: 'shown', shown_at: new Date() })
      .where(eq(ripplePushes.id, row.push.id));
    notifications.push({
      type: 'ripple',
      delivery_id: row.push.id,
      ripple_id: row.ripple.id,
      skill_name: row.skill.name,
      skill_display_name: row.skill.display_name,
      skill_slug: row.skill.name,
      sender: toUserBrief(row.sender),
      ...(row.ripple.comment ? { comment: row.ripple.comment } : {}),
    });
  }
  return notifications;
}

/** 注册/登录时认领游客会话的投递 */
export async function claimGuestSessionDeliveries(
  db: Db,
  sessionKey: string,
  userId: string,
): Promise<number> {
  const sessions = await db
    .select()
    .from(guestSessions)
    .where(eq(guestSessions.session_key, sessionKey))
    .limit(1);
  const session = sessions[0];
  if (!session || session.claimed_user_id) return 0;

  await db
    .update(guestSessions)
    .set({ claimed_user_id: userId })
    .where(eq(guestSessions.id, session.id));

  const pushes = await db
    .select({ push: ripplePushes, ripple: ripples })
    .from(ripplePushes)
    .innerJoin(ripples, eq(ripplePushes.ripple_id, ripples.id))
    .where(and(eq(ripplePushes.guest_session_id, session.id), eq(ripplePushes.status, 'pending')));

  let claimed = 0;
  for (const { push, ripple } of pushes) {
    const [liked, existing] = await Promise.all([
      db
        .select({ id: userSkillLikes.id })
        .from(userSkillLikes)
        .where(and(eq(userSkillLikes.user_id, userId), eq(userSkillLikes.skill_id, ripple.skill_id)))
        .limit(1),
      db
        .select({ id: ripplePushes.id })
        .from(ripplePushes)
        .where(and(eq(ripplePushes.ripple_id, ripple.id), eq(ripplePushes.target_user_id, userId)))
        .limit(1),
    ]);
    if (liked.length > 0 || existing.length > 0) {
      await db
        .update(ripplePushes)
        .set({ status: 'dismissed' })
        .where(eq(ripplePushes.id, push.id));
    } else {
      await db
        .update(ripplePushes)
        .set({ target_user_id: userId, guest_session_id: null })
        .where(eq(ripplePushes.id, push.id));
      claimed++;
    }
  }
  return claimed;
}

export async function touchGuestSession(db: Db, sessionKey: string): Promise<void> {
  const updated = await db
    .update(guestSessions)
    .set({ last_seen_at: new Date() })
    .where(eq(guestSessions.session_key, sessionKey))
    .returning({ id: guestSessions.id });
  if (updated.length === 0) {
    await db.insert(guestSessions).values({ session_key: sessionKey }).onConflictDoNothing();
  }
}
