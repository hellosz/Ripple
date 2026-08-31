import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { createRippleInputSchema } from '@ripple/contract';
import type { AppDeps, Guards } from '../app.js';
import { skills, userSkillCopies, userSkillLikes } from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import { toEngagement, toStats } from '../lib/serialize.js';
import { getEngagements, getSkillWithCounts, getWeeklyMaxHeat } from '../services/skill-query.js';
import { createRippleWithPushes } from '../services/ripple-service.js';

export function registerInteractionRoutes(app: FastifyInstance, deps: AppDeps, guards: Guards): void {
  const { db } = deps;

  async function findSkillOr404(slug: string) {
    const rows = await db.select().from(skills).where(eq(skills.name, slug)).limit(1);
    const skill = rows[0];
    if (!skill) throw AppError.notFound('Skill not found');
    return skill;
  }

  async function statsPayload(skillId: string, userId: string | null) {
    const found = await getSkillWithCounts(db, eq(skills.id, skillId));
    const weeklyMax = await getWeeklyMaxHeat(db, deps.redis);
    const engagement = userId
      ? ((await getEngagements(db, userId, [skillId])).get(skillId) ?? null)
      : null;
    return {
      stats: toStats(found!.counts, weeklyMax),
      engagement_state: toEngagement(engagement),
    };
  }

  app.post('/api/skills/:slug/copy', { preHandler: guards.requireAuth }, async (request) => {
    const { slug } = request.params as { slug: string };
    const skill = await findSkillOr404(slug);
    const command = skill.install_command ?? `ripple install ${skill.name}`;
    await db
      .insert(userSkillCopies)
      .values({ user_id: request.currentUser!.id, skill_id: skill.id, command })
      .onConflictDoNothing();
    const payload = await statsPayload(skill.id, request.currentUser!.id);
    return { command, ...payload };
  });

  app.post('/api/skills/:slug/like', { preHandler: guards.requireAuth }, async (request) => {
    const { slug } = request.params as { slug: string };
    const skill = await findSkillOr404(slug);
    const inserted = await db
      .insert(userSkillLikes)
      .values({ user_id: request.currentUser!.id, skill_id: skill.id })
      .onConflictDoNothing()
      .returning({ id: userSkillLikes.id });
    if (inserted.length === 0) throw AppError.badRequest('Already liked', 'already_liked');
    return statsPayload(skill.id, request.currentUser!.id);
  });

  app.delete('/api/skills/:slug/like', { preHandler: guards.requireAuth }, async (request) => {
    const { slug } = request.params as { slug: string };
    const skill = await findSkillOr404(slug);
    const deleted = await db
      .delete(userSkillLikes)
      .where(
        and(
          eq(userSkillLikes.user_id, request.currentUser!.id),
          eq(userSkillLikes.skill_id, skill.id),
        ),
      )
      .returning({ id: userSkillLikes.id });
    if (deleted.length === 0) throw AppError.badRequest('Not liked yet', 'not_liked');
    return statsPayload(skill.id, request.currentUser!.id);
  });

  app.post('/api/skills/:slug/ripple', { preHandler: guards.requireAuth }, async (request) => {
    const { slug } = request.params as { slug: string };
    const input = createRippleInputSchema.parse(request.body ?? {});
    const skill = await findSkillOr404(slug);
    const userId = request.currentUser!.id;

    const engagement = (await getEngagements(db, userId, [skill.id])).get(skill.id) ?? null;
    if (!engagement?.copied_at) {
      throw AppError.badRequest('Copy the install command before rippling', 'copy_required');
    }
    if (!engagement.liked_at) {
      throw AppError.badRequest('Like the skill before rippling', 'like_required');
    }
    if (engagement.rippled_at) {
      throw AppError.badRequest('Already rippled this skill', 'already_rippled');
    }

    const result = await createRippleWithPushes(db, deps.hub, {
      senderId: userId,
      skillId: skill.id,
      comment: input.comment ?? null,
    });
    const payload = await statsPayload(skill.id, userId);
    return { ripple_id: result.rippleId, push_count: result.pushCount, ...payload };
  });

  app.get('/api/skills/:slug/stats', { preHandler: guards.optionalAuth }, async (request) => {
    const { slug } = request.params as { slug: string };
    const skill = await findSkillOr404(slug);
    return statsPayload(skill.id, request.currentUser?.id ?? null);
  });
}
