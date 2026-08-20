import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  buildFileTree,
  buildZip,
  stripFrontmatter,
} from '@ripple/skill-core';
import {
  createCommentInputSchema,
  skillListQuerySchema,
  skillUploadFormSchema,
  updateSkillStatusInputSchema,
  type SkillComment,
  type SkillDetail,
  type SkillListItem,
  type UpdateNotification,
} from '@ripple/contract';
import type { AppDeps, Guards } from '../app.js';
import {
  skillComments,
  skillFiles,
  skillVersions,
  skillViews,
  skills,
  userSkillDownloads,
  users,
} from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import { toSkillListItem, toUserBrief, type EngagementRow } from '../lib/serialize.js';
import {
  getEngagements,
  getSkillWithCounts,
  getWeeklyMaxHeat,
  listSkills,
} from '../services/skill-query.js';
import { uploadSkill } from '../services/skill-upload.js';

async function readUploadForm(request: {
  parts: () => AsyncIterableIterator<
    | { type: 'file'; filename: string; toBuffer: () => Promise<Buffer> }
    | { type: 'field'; fieldname: string; value: unknown }
  >;
}): Promise<{ data: Uint8Array | null; fileName: string; fields: Record<string, string> }> {
  let data: Uint8Array | null = null;
  let fileName = 'skill.zip';
  const fields: Record<string, string> = {};
  for await (const part of request.parts()) {
    if (part.type === 'file') {
      fileName = part.filename;
      data = new Uint8Array(await part.toBuffer());
    } else if (typeof part.value === 'string') {
      fields[part.fieldname] = part.value;
    }
  }
  return { data, fileName, fields };
}

export function registerSkillRoutes(app: FastifyInstance, deps: AppDeps, guards: Guards): void {
  const { db, config } = deps;

  async function currentVersionOf(skillId: string, version: string) {
    return db
      .select()
      .from(skillFiles)
      .where(and(eq(skillFiles.skill_id, skillId), eq(skillFiles.version, version)))
      .orderBy(asc(skillFiles.path));
  }

  async function findSkillOr404(slug: string) {
    const rows = await db.select().from(skills).where(eq(skills.name, slug)).limit(1);
    const skill = rows[0];
    if (!skill) throw AppError.notFound('Skill not found');
    return skill;
  }

  async function serializeMany(
    items: Awaited<ReturnType<typeof listSkills>>['items'],
    userId: string | null,
  ): Promise<SkillListItem[]> {
    const weeklyMax = await getWeeklyMaxHeat(db, deps.redis);
    const engagements = userId
      ? await getEngagements(
          db,
          userId,
          items.map((i) => i.skill.id),
        )
      : new Map<string, EngagementRow>();
    return items.map((i) =>
      toSkillListItem(
        i.skill,
        toUserBrief(i.author),
        i.counts,
        engagements.get(i.skill.id) ?? null,
        weeklyMax,
        config.APP_BASE_URL,
      ),
    );
  }

  // ---- 列表 ----
  app.get('/api/skills', { preHandler: guards.optionalAuth }, async (request) => {
    const query = skillListQuerySchema.parse(request.query);
    const user = request.currentUser;
    const { items, total } = await listSkills(db, {
      ...query,
      includeGray: user?.role === 'admin',
      userId: user?.id,
    });
    return {
      items: await serializeMany(items, user?.id ?? null),
      total,
      page: query.page,
      page_size: query.page_size,
    };
  });

  // ---- 热度榜 ----
  app.get('/api/skills/rank/heat', { preHandler: guards.optionalAuth }, async (request) => {
    const { limit } = (request.query ?? {}) as { limit?: string };
    const n = Math.min(Math.max(Number(limit) || 5, 1), 50);
    const { items } = await listSkills(db, {
      sort_by: 'heat',
      page: 1,
      page_size: n,
      includeGray: request.currentUser?.role === 'admin',
    });
    return serializeMany(items, request.currentUser?.id ?? null);
  });

  // ---- 详情 ----
  app.get('/api/skills/:slug', { preHandler: guards.optionalAuth }, async (request) => {
    const { slug } = request.params as { slug: string };
    const user = request.currentUser;
    const found = await getSkillWithCounts(db, eq(skills.name, slug));
    if (!found) throw AppError.notFound('Skill not found');
    if (found.skill.publish_channel === 'gray' && user?.role !== 'admin') {
      throw AppError.notFound('Skill not found');
    }
    const weeklyMax = await getWeeklyMaxHeat(db, deps.redis);
    const engagement = user
      ? ((await getEngagements(db, user.id, [found.skill.id])).get(found.skill.id) ?? null)
      : null;
    const base = toSkillListItem(
      found.skill,
      toUserBrief(found.author),
      found.counts,
      engagement,
      weeklyMax,
      config.APP_BASE_URL,
    );
    const files = await currentVersionOf(found.skill.id, found.skill.version);
    const skillMd = files.find((f) => f.path === 'SKILL.md');
    const versions = await db
      .select()
      .from(skillVersions)
      .where(eq(skillVersions.skill_id, found.skill.id))
      .orderBy(desc(skillVersions.created_at));
    const detail: SkillDetail = {
      ...base,
      content: skillMd ? stripFrontmatter(skillMd.content) : null,
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        changelog: v.changelog,
        rating: v.rating,
        created_at: v.created_at.toISOString(),
      })),
    };
    return detail;
  });

  // ---- 文件树 / 文件内容 / 版本 ----
  app.get('/api/skills/:slug/files', async (request) => {
    const { slug } = request.params as { slug: string };
    const skill = await findSkillOr404(slug);
    const files = await currentVersionOf(skill.id, skill.version);
    return buildFileTree(files.map((f) => ({ path: f.path, size: f.size })));
  });

  app.get('/api/skills/:slug/files/*', async (request) => {
    const { slug } = request.params as { slug: string };
    const filePath = decodeURI((request.params as { '*': string })['*']);
    const skill = await findSkillOr404(slug);
    const rows = await db
      .select()
      .from(skillFiles)
      .where(
        and(
          eq(skillFiles.skill_id, skill.id),
          eq(skillFiles.version, skill.version),
          eq(skillFiles.path, filePath),
        ),
      )
      .limit(1);
    const file = rows[0];
    if (!file) throw AppError.notFound('File not found');
    return {
      path: file.path,
      name: file.path.split('/').pop() ?? file.path,
      content: file.content,
      language: file.language,
      size: file.size,
    };
  });

  app.get('/api/skills/:slug/versions', async (request) => {
    const { slug } = request.params as { slug: string };
    const skill = await findSkillOr404(slug);
    const versions = await db
      .select()
      .from(skillVersions)
      .where(eq(skillVersions.skill_id, skill.id))
      .orderBy(desc(skillVersions.created_at));
    return versions.map((v) => ({
      id: v.id,
      version: v.version,
      changelog: v.changelog,
      rating: v.rating,
      created_at: v.created_at.toISOString(),
    }));
  });

  // ---- 下载 ----
  app.get('/api/skills/:slug/download', { preHandler: guards.optionalAuth }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const skill = await findSkillOr404(slug);

    let payload: Uint8Array | null = null;
    if (skill.package_storage_path) {
      payload = await deps.storage.getPackage(skill.package_storage_path);
    }
    if (!payload) {
      const files = await currentVersionOf(skill.id, skill.version);
      if (files.length === 0) throw AppError.notFound('Package not available', 'package_missing');
      const zipInput: Record<string, string> = {};
      for (const f of files) zipInput[f.path] = f.content;
      payload = buildZip(zipInput);
    }

    if (request.currentUser) {
      await db
        .insert(userSkillDownloads)
        .values({ user_id: request.currentUser.id, skill_id: skill.id, version: skill.version })
        .onConflictDoNothing();
    }

    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="${skill.name}-${skill.version}.zip"`)
      .send(Buffer.from(payload));
  });

  // ---- 上传 / 更新 ----
  app.post('/api/skills', { preHandler: guards.requireAdmin }, async (request, reply) => {
    const { data, fileName, fields } = await readUploadForm(
      request as unknown as Parameters<typeof readUploadForm>[0],
    );
    if (!data) throw AppError.badRequest('Missing package file', 'missing_file');
    const form = skillUploadFormSchema.parse(fields);
    const outcome = await uploadSkill(db, deps.storage, {
      data,
      fileName,
      form,
      authorId: request.currentUser!.id,
    });
    if (outcome.isUpdate) await notifyDownloaders(outcome.skill.id, outcome.skill.name, outcome.version);
    return reply.status(201).send(await uploadResultPayload(outcome.skill.name, outcome));
  });

  app.put('/api/skills/:slug', { preHandler: guards.requireAdmin }, async (request) => {
    const { slug } = request.params as { slug: string };
    const skill = await findSkillOr404(slug);
    if (skill.author_id !== request.currentUser!.id) {
      throw AppError.forbidden('Only the author can update this skill', 'not_author');
    }
    const { data, fileName, fields } = await readUploadForm(
      request as unknown as Parameters<typeof readUploadForm>[0],
    );
    if (!data) throw AppError.badRequest('Missing package file', 'missing_file');
    const form = skillUploadFormSchema.parse(fields);
    const outcome = await uploadSkill(db, deps.storage, {
      data,
      fileName,
      form,
      authorId: request.currentUser!.id,
    });
    if (outcome.skill.id !== skill.id) {
      throw AppError.badRequest(
        'Package frontmatter name does not match this skill',
        'name_mismatch',
      );
    }
    await notifyDownloaders(skill.id, skill.name, outcome.version);
    return uploadResultPayload(slug, outcome);
  });

  async function uploadResultPayload(
    slug: string,
    outcome: Awaited<ReturnType<typeof uploadSkill>>,
  ) {
    const found = await getSkillWithCounts(db, eq(skills.name, outcome.skill.name));
    const weeklyMax = await getWeeklyMaxHeat(db, deps.redis);
    const base = toSkillListItem(
      found!.skill,
      toUserBrief(found!.author),
      found!.counts,
      null,
      weeklyMax,
      config.APP_BASE_URL,
    );
    const detail: SkillDetail = { ...base, content: null, versions: [] };
    return {
      skill: detail,
      rating: outcome.rating,
      suggestions: outcome.suggestions,
      install_command: base.install_command,
      download_url: base.download_url,
    };
  }

  async function notifyDownloaders(skillId: string, slug: string, version: string): Promise<void> {
    const downloaders = await db
      .select({ user_id: userSkillDownloads.user_id })
      .from(userSkillDownloads)
      .where(eq(userSkillDownloads.skill_id, skillId));
    const skillRows = await db.select().from(skills).where(eq(skills.id, skillId)).limit(1);
    const skill = skillRows[0];
    if (!skill) return;
    const notification: UpdateNotification = {
      type: 'skill_update',
      skill_name: skill.name,
      skill_display_name: skill.display_name,
      skill_slug: slug,
      new_version: version,
    };
    for (const { user_id } of downloaders) {
      if (deps.hub.isUserOnline(user_id)) await deps.hub.notify(user_id, notification);
    }
  }

  // ---- 状态 ----
  app.patch('/api/skills/:slug/status', { preHandler: guards.requireAuth }, async (request) => {
    const { slug } = request.params as { slug: string };
    const input = updateSkillStatusInputSchema.parse(request.body);
    const skill = await findSkillOr404(slug);
    const user = request.currentUser!;
    if (skill.author_id !== user.id && user.role !== 'admin') {
      throw AppError.forbidden('Only the author or admin can change status', 'not_author');
    }
    await db
      .update(skills)
      .set({ status: input.status, updated_at: new Date() })
      .where(eq(skills.id, skill.id));
    const found = await getSkillWithCounts(db, eq(skills.id, skill.id));
    const weeklyMax = await getWeeklyMaxHeat(db, deps.redis);
    const base = toSkillListItem(
      found!.skill,
      toUserBrief(found!.author),
      found!.counts,
      null,
      weeklyMax,
      config.APP_BASE_URL,
    );
    return { ...base, content: null, versions: [] };
  });

  // ---- 评论 ----
  app.get('/api/skills/:slug/comments', async (request) => {
    const { slug } = request.params as { slug: string };
    const skill = await findSkillOr404(slug);
    const rows = await db
      .select({ comment: skillComments, author: users })
      .from(skillComments)
      .innerJoin(users, eq(skillComments.author_id, users.id))
      .where(eq(skillComments.skill_id, skill.id))
      .orderBy(desc(skillComments.created_at));
    return buildCommentTree(rows);
  });

  app.post(
    '/api/skills/:slug/comments',
    { preHandler: guards.requireAuth },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const input = createCommentInputSchema.parse(request.body);
      const skill = await findSkillOr404(slug);
      if (input.parent_id) {
        const parentRows = await db
          .select({ id: skillComments.id, skill_id: skillComments.skill_id })
          .from(skillComments)
          .where(eq(skillComments.id, input.parent_id))
          .limit(1);
        if (!parentRows[0] || parentRows[0].skill_id !== skill.id) {
          throw AppError.badRequest('Invalid parent comment', 'invalid_parent');
        }
      }
      const rows = await db
        .insert(skillComments)
        .values({
          skill_id: skill.id,
          author_id: request.currentUser!.id,
          parent_id: input.parent_id ?? null,
          content: input.content,
        })
        .returning();
      const comment = rows[0]!;
      return reply.status(201).send({
        id: comment.id,
        skill_id: comment.skill_id,
        parent_id: comment.parent_id,
        content: comment.content,
        author: toUserBrief(request.currentUser!),
        children: [],
        created_at: comment.created_at.toISOString(),
        updated_at: comment.updated_at.toISOString(),
      } satisfies SkillComment);
    },
  );

  // ---- 浏览计数（按日去重）----
  app.post('/api/skills/:slug/view', { preHandler: guards.optionalAuth }, async (request) => {
    const { slug } = request.params as { slug: string };
    const skill = await findSkillOr404(slug);
    const user = request.currentUser;
    const guestHeader = request.headers['x-ripple-guest-session'];
    const guestKey = Array.isArray(guestHeader) ? guestHeader[0] : guestHeader;
    const today = new Date().toISOString().slice(0, 10);
    let counted = false;
    if (user) {
      const rows = await db
        .insert(skillViews)
        .values({ skill_id: skill.id, user_id: user.id, view_date: today })
        .onConflictDoNothing()
        .returning({ id: skillViews.id });
      counted = rows.length > 0;
    } else if (guestKey && /^[A-Za-z0-9_-]{8,64}$/.test(guestKey)) {
      const rows = await db
        .insert(skillViews)
        .values({ skill_id: skill.id, guest_session_key: guestKey, view_date: today })
        .onConflictDoNothing()
        .returning({ id: skillViews.id });
      counted = rows.length > 0;
    }
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(skillViews)
      .where(eq(skillViews.skill_id, skill.id));
    return { counted, view_count: countRows[0]?.count ?? 0 };
  });
}

type CommentJoinRow = {
  comment: typeof skillComments.$inferSelect;
  author: typeof users.$inferSelect;
};

export function buildCommentTree(rows: CommentJoinRow[]): SkillComment[] {
  const nodes = new Map<string, SkillComment>();
  for (const { comment, author } of rows) {
    nodes.set(comment.id, {
      id: comment.id,
      skill_id: comment.skill_id,
      parent_id: comment.parent_id,
      content: comment.content,
      author: toUserBrief(author),
      children: [],
      created_at: comment.created_at.toISOString(),
      updated_at: comment.updated_at.toISOString(),
    });
  }
  const roots: SkillComment[] = [];
  for (const node of nodes.values()) {
    if (node.parent_id && nodes.has(node.parent_id)) {
      nodes.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
