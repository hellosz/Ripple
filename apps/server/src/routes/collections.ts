import { asc, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { upsertCollectionInputSchema, type Collection } from '@ripple/contract';
import type { AppDeps, Guards } from '../app.js';
import { collectionSkills, collections, skills } from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import { toSkillListItem, toUserBrief, type EngagementRow } from '../lib/serialize.js';
import { getEngagements, getWeeklyMaxHeat, listSkills } from '../services/skill-query.js';

export function registerCollectionRoutes(app: FastifyInstance, deps: AppDeps, guards: Guards): void {
  const { db, config } = deps;

  async function serializeCollection(
    row: typeof collections.$inferSelect,
    userId: string | null,
  ): Promise<Collection> {
    const links = await db
      .select()
      .from(collectionSkills)
      .where(eq(collectionSkills.collection_id, row.id))
      .orderBy(asc(collectionSkills.position));
    const skillIds = links.map((l) => l.skill_id);
    const { items } = skillIds.length
      ? await listSkills(db, { skillIds, page: 1, page_size: 100 })
      : { items: [] };
    const weeklyMax = await getWeeklyMaxHeat(db, deps.redis);
    const engagements = userId
      ? await getEngagements(db, userId, skillIds)
      : new Map<string, EngagementRow>();
    const ordered = skillIds
      .map((id) => items.find((i) => i.skill.id === id))
      .filter((i): i is NonNullable<typeof i> => Boolean(i));
    const serialized = ordered.map((i) =>
      toSkillListItem(
        i.skill,
        toUserBrief(i.author),
        i.counts,
        engagements.get(i.skill.id) ?? null,
        weeklyMax,
        config.APP_BASE_URL,
      ),
    );
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      curator: row.curator,
      gradient: row.gradient,
      skill_count: serialized.length,
      total_heat: serialized.reduce((sum, s) => sum + s.stats.heat, 0),
      skills: serialized,
      created_at: row.created_at.toISOString(),
    };
  }

  app.get('/api/collections', { preHandler: guards.optionalAuth }, async (request) => {
    const rows = await db.select().from(collections).orderBy(asc(collections.created_at));
    const result: Collection[] = [];
    for (const row of rows) {
      result.push(await serializeCollection(row, request.currentUser?.id ?? null));
    }
    return result;
  });

  app.get('/api/collections/:slug', { preHandler: guards.optionalAuth }, async (request) => {
    const { slug } = request.params as { slug: string };
    const rows = await db.select().from(collections).where(eq(collections.slug, slug)).limit(1);
    if (!rows[0]) throw AppError.notFound('Collection not found');
    return serializeCollection(rows[0], request.currentUser?.id ?? null);
  });

  app.post('/api/collections', { preHandler: guards.requireAdmin }, async (request, reply) => {
    const input = upsertCollectionInputSchema.parse(request.body);
    const skillRows = await db
      .select({ id: skills.id, name: skills.name })
      .from(skills)
      .where(inArray(skills.name, input.skill_names));
    const byName = new Map(skillRows.map((s) => [s.name, s.id]));
    const missing = input.skill_names.filter((n) => !byName.has(n));
    if (missing.length > 0) {
      throw AppError.badRequest(`Unknown skills: ${missing.join(', ')}`, 'unknown_skills');
    }

    const existing = await db
      .select()
      .from(collections)
      .where(eq(collections.slug, input.slug))
      .limit(1);
    let collection: typeof collections.$inferSelect;
    if (existing[0]) {
      const rows = await db
        .update(collections)
        .set({
          name: input.name,
          description: input.description,
          curator: input.curator,
          gradient: input.gradient ?? null,
          updated_at: new Date(),
        })
        .where(eq(collections.id, existing[0].id))
        .returning();
      collection = rows[0]!;
      await db.delete(collectionSkills).where(eq(collectionSkills.collection_id, collection.id));
    } else {
      const rows = await db
        .insert(collections)
        .values({
          slug: input.slug,
          name: input.name,
          description: input.description,
          curator: input.curator,
          gradient: input.gradient ?? null,
        })
        .returning();
      collection = rows[0]!;
    }
    await db.insert(collectionSkills).values(
      input.skill_names.map((name, i) => ({
        collection_id: collection.id,
        skill_id: byName.get(name)!,
        position: i,
      })),
    );
    const payload = await serializeCollection(collection, null);
    return reply.status(existing[0] ? 200 : 201).send(payload);
  });

  app.delete('/api/collections/:slug', { preHandler: guards.requireAdmin }, async (request) => {
    const { slug } = request.params as { slug: string };
    const rows = await db
      .delete(collections)
      .where(eq(collections.slug, slug))
      .returning({ id: collections.id });
    if (!rows[0]) throw AppError.notFound('Collection not found');
    return { id: rows[0].id, deleted: true };
  });
}
