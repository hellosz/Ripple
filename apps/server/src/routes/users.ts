import { and, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { updateProfileInputSchema, type SkillListItem } from '@ripple/contract';
import type { AppDeps, Guards } from '../app.js';
import {
  ripplePushes,
  ripples,
  skills,
  userFollows,
  userSkillDownloads,
  userSkillLikes,
  users,
} from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import { toSkillListItem, toUser, toUserBrief } from '../lib/serialize.js';
import { getEngagements, getSkillWithCounts, getWeeklyMaxHeat } from '../services/skill-query.js';

export function registerUserRoutes(app: FastifyInstance, deps: AppDeps, guards: Guards): void {
  const { db, config } = deps;

  app.put('/api/users/me', { preHandler: guards.requireAuth }, async (request) => {
    const input = updateProfileInputSchema.parse(request.body);
    const rows = await db
      .update(users)
      .set({ ...input, updated_at: new Date() })
      .where(eq(users.id, request.currentUser!.id))
      .returning();
    return toUser(rows[0]!);
  });

  app.post(
    '/api/users/me/generate-profile',
    { preHandler: guards.requireAuth },
    async (request) => {
      const user = request.currentUser!;
      return deps.llm.generateProfileCandidates({
        gender: user.gender,
        zodiac: user.zodiac,
        tags: user.tags ?? null,
      });
    },
  );

  async function serializeSkillIds(skillIds: string[], userId: string): Promise<SkillListItem[]> {
    if (skillIds.length === 0) return [];
    const weeklyMax = await getWeeklyMaxHeat(db, deps.redis);
    const engagements = await getEngagements(db, userId, skillIds);
    const items: SkillListItem[] = [];
    for (const id of skillIds) {
      const found = await getSkillWithCounts(db, eq(skills.id, id));
      if (!found) continue;
      items.push(
        toSkillListItem(
          found.skill,
          toUserBrief(found.author),
          found.counts,
          engagements.get(id) ?? null,
          weeklyMax,
          config.APP_BASE_URL,
        ),
      );
    }
    return items;
  }

  app.get('/api/users/me/likes', { preHandler: guards.requireAuth }, async (request) => {
    const rows = await db
      .select({ skill_id: userSkillLikes.skill_id })
      .from(userSkillLikes)
      .where(eq(userSkillLikes.user_id, request.currentUser!.id))
      .orderBy(desc(userSkillLikes.created_at));
    return serializeSkillIds(
      rows.map((r) => r.skill_id),
      request.currentUser!.id,
    );
  });

  app.get('/api/users/me/downloads', { preHandler: guards.requireAuth }, async (request) => {
    const rows = await db
      .select({ skill_id: userSkillDownloads.skill_id })
      .from(userSkillDownloads)
      .where(eq(userSkillDownloads.user_id, request.currentUser!.id))
      .orderBy(desc(userSkillDownloads.created_at));
    return serializeSkillIds(
      rows.map((r) => r.skill_id),
      request.currentUser!.id,
    );
  });

  app.get('/api/users/me/skills', { preHandler: guards.requireAuth }, async (request) => {
    const rows = await db
      .select({ id: skills.id })
      .from(skills)
      .where(eq(skills.author_id, request.currentUser!.id))
      .orderBy(desc(skills.created_at));
    return serializeSkillIds(
      rows.map((r) => r.id),
      request.currentUser!.id,
    );
  });

  app.get('/api/users/me/ripples', { preHandler: guards.requireAuth }, async (request) => {
    const myRipples = await db
      .select({ ripple: ripples, skill: skills })
      .from(ripples)
      .innerJoin(skills, eq(ripples.skill_id, skills.id))
      .where(eq(ripples.sender_id, request.currentUser!.id))
      .orderBy(desc(ripples.created_at));
    const sender = toUserBrief(request.currentUser!);
    const rippleIds = myRipples.map((r) => r.ripple.id);
    const pushes = rippleIds.length
      ? await db
          .select({ push: ripplePushes, target: users })
          .from(ripplePushes)
          .leftJoin(users, eq(ripplePushes.target_user_id, users.id))
          .where(inArray(ripplePushes.ripple_id, rippleIds))
      : [];
    return myRipples.map(({ ripple, skill }) => ({
      id: ripple.id,
      skill_id: skill.id,
      skill_name: skill.name,
      skill_display_name: skill.display_name,
      sender,
      comment: ripple.comment,
      pushes: pushes
        .filter((p) => p.push.ripple_id === ripple.id)
        .map((p) => ({
          id: p.push.id,
          target_user: p.target ? toUserBrief(p.target) : null,
          status: p.push.status,
          shown_at: p.push.shown_at?.toISOString() ?? null,
          consumed_at: p.push.consumed_at?.toISOString() ?? null,
        })),
      created_at: ripple.created_at.toISOString(),
    }));
  });

  // ---- 关注 ----

  app.post('/api/users/:userId/follow', { preHandler: guards.requireAuth }, async (request) => {
    const { userId } = request.params as { userId: string };
    if (userId === request.currentUser!.id) {
      throw AppError.badRequest('Cannot follow yourself', 'self_follow');
    }
    const followeeRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const followee = followeeRows[0];
    if (!followee) throw AppError.notFound('User not found');
    await db
      .insert(userFollows)
      .values({ follower_id: request.currentUser!.id, followee_id: userId })
      .onConflictDoNothing();
    return { following: true, followee: toUserBrief(followee) };
  });

  app.delete('/api/users/:userId/follow', { preHandler: guards.requireAuth }, async (request) => {
    const { userId } = request.params as { userId: string };
    const followeeRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const followee = followeeRows[0];
    if (!followee) throw AppError.notFound('User not found');
    await db
      .delete(userFollows)
      .where(
        and(
          eq(userFollows.follower_id, request.currentUser!.id),
          eq(userFollows.followee_id, userId),
        ),
      );
    return { following: false, followee: toUserBrief(followee) };
  });

  app.get('/api/users/me/following', { preHandler: guards.requireAuth }, async (request) => {
    const rows = await db
      .select({ followee: users })
      .from(userFollows)
      .innerJoin(users, eq(userFollows.followee_id, users.id))
      .where(eq(userFollows.follower_id, request.currentUser!.id))
      .orderBy(desc(userFollows.created_at));
    return { items: rows.map((r) => toUserBrief(r.followee)), total: rows.length };
  });
}
