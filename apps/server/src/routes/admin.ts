import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { updateUserStatusInputSchema, updateSkillStatusInputSchema } from '@ripple/contract';
import type { AppDeps, Guards } from '../app.js';
import {
  ripples,
  skills,
  userSkillDownloads,
  userSkillLikes,
  users,
} from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import { toStats } from '../lib/serialize.js';
import { getSkillWithCounts, getWeeklyMaxHeat, listSkills } from '../services/skill-query.js';

const pageQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

export function registerAdminRoutes(app: FastifyInstance, deps: AppDeps, guards: Guards): void {
  const { db } = deps;
  const adminOnly = { preHandler: guards.requireAdmin };

  const toAdminUser = (u: typeof users.$inferSelect) => ({
    id: u.id,
    email: u.email,
    nickname: u.nickname,
    role: u.role,
    status: u.status,
    created_at: u.created_at.toISOString(),
  });

  app.get('/api/admin/users', adminOnly, async (request) => {
    const query = pageQuery.parse(request.query);
    const where = query.search
      ? or(ilike(users.email, `%${query.search}%`), ilike(users.nickname, `%${query.search}%`))
      : undefined;
    const totalRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(where);
    const rows = await db
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.created_at))
      .limit(query.page_size)
      .offset((query.page - 1) * query.page_size);
    return {
      items: rows.map(toAdminUser),
      total: totalRows[0]?.count ?? 0,
      page: query.page,
      page_size: query.page_size,
    };
  });

  app.patch('/api/admin/users/:userId/status', adminOnly, async (request) => {
    const { userId } = request.params as { userId: string };
    const input = updateUserStatusInputSchema.parse(request.body);
    const rows = await db
      .update(users)
      .set({ status: input.status, updated_at: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (!rows[0]) throw AppError.notFound('User not found');
    return toAdminUser(rows[0]);
  });

  async function adminSkillPayload(skillId: string) {
    const found = await getSkillWithCounts(db, eq(skills.id, skillId));
    if (!found) throw AppError.notFound('Skill not found');
    const weeklyMax = await getWeeklyMaxHeat(db, deps.redis);
    return {
      id: found.skill.id,
      name: found.skill.name,
      display_name: found.skill.display_name,
      rating: found.skill.rating,
      status: found.skill.status,
      publish_channel: found.skill.publish_channel,
      author_email: found.author.email,
      stats: toStats(found.counts, weeklyMax),
      created_at: found.skill.created_at.toISOString(),
      updated_at: found.skill.updated_at.toISOString(),
    };
  }

  app.get('/api/admin/skills', adminOnly, async (request) => {
    const query = pageQuery.parse(request.query);
    const { items, total } = await listSkills(db, {
      search: query.search,
      page: query.page,
      page_size: query.page_size,
      includeGray: true,
      includeAllStatuses: true,
      sort_by: 'updated_at',
    });
    const weeklyMax = await getWeeklyMaxHeat(db, deps.redis);
    return {
      items: items.map((i) => ({
        id: i.skill.id,
        name: i.skill.name,
        display_name: i.skill.display_name,
        rating: i.skill.rating,
        status: i.skill.status,
        publish_channel: i.skill.publish_channel,
        author_email: i.author.email,
        stats: toStats(i.counts, weeklyMax),
        created_at: i.skill.created_at.toISOString(),
        updated_at: i.skill.updated_at.toISOString(),
      })),
      total,
      page: query.page,
      page_size: query.page_size,
    };
  });

  app.patch('/api/admin/skills/:skillId/status', adminOnly, async (request) => {
    const { skillId } = request.params as { skillId: string };
    const input = updateSkillStatusInputSchema.parse(request.body);
    const rows = await db
      .update(skills)
      .set({ status: input.status, updated_at: new Date() })
      .where(eq(skills.id, skillId))
      .returning({ id: skills.id });
    if (!rows[0]) throw AppError.notFound('Skill not found');
    return adminSkillPayload(skillId);
  });

  app.get('/api/admin/stats', adminOnly, async () => {
    const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [skillCount] = await db.select({ count: sql<number>`count(*)::int` }).from(skills);
    const ratingRows = await db
      .select({ rating: skills.rating, count: sql<number>`count(*)::int` })
      .from(skills)
      .groupBy(skills.rating);
    const originRows = await db
      .select({ origin: skills.origin_type, count: sql<number>`count(*)::int` })
      .from(skills)
      .groupBy(skills.origin_type);
    const [likeCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userSkillLikes);
    const [downloadCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userSkillDownloads);
    const [rippleCount] = await db.select({ count: sql<number>`count(*)::int` }).from(ripples);
    return {
      users: { total: userCount?.count ?? 0 },
      skills: {
        total: skillCount?.count ?? 0,
        rating_distribution: Object.fromEntries(ratingRows.map((r) => [r.rating, r.count])),
        origin_distribution: Object.fromEntries(originRows.map((r) => [r.origin, r.count])),
      },
      interactions: {
        total_likes: likeCount?.count ?? 0,
        total_downloads: downloadCount?.count ?? 0,
        total_ripples: rippleCount?.count ?? 0,
      },
    };
  });

  app.get('/api/admin/stats/top', adminOnly, async () => {
    const top = async (table: typeof userSkillDownloads | typeof userSkillLikes | typeof ripples) => {
      const rows = await db
        .select({
          name: skills.name,
          display_name: skills.display_name,
          count: sql<number>`count(*)::int`,
        })
        .from(table)
        .innerJoin(skills, eq(table.skill_id, skills.id))
        .groupBy(skills.id, skills.name, skills.display_name)
        .orderBy(sql`count(*) desc`)
        .limit(10);
      return rows;
    };
    return {
      top_downloads: await top(userSkillDownloads),
      top_likes: await top(userSkillLikes),
      top_ripples: await top(ripples),
    };
  });
}
