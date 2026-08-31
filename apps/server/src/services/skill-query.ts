import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import {
  skills,
  userFollows,
  userSkillCopies,
  userSkillDownloads,
  userSkillLikes,
  ripples as ripplesTable,
  users,
} from '../db/schema.js';
import type { EngagementRow, SkillCounts, SkillRow } from '../lib/serialize.js';
import type { RedisService } from './redis.js';
import type { SkillListQuery } from '@ripple/contract';

const WEEK = sql`now() - interval '7 days'`;

/** 每技能计数（标量子查询；单条 SQL 内完成，无 N+1） */
const countsSelection = {
  copy_count: sql<number>`(select count(*) from user_skill_copies c where c.skill_id = ${skills.id})::int`,
  like_count: sql<number>`(select count(*) from user_skill_likes l where l.skill_id = ${skills.id})::int`,
  download_count: sql<number>`(select count(*) from user_skill_downloads d where d.skill_id = ${skills.id})::int`,
  ripple_count: sql<number>`(select count(*) from ripples r where r.skill_id = ${skills.id})::int`,
  ripple_reach: sql<number>`(select count(*) from ripple_pushes p join ripples r on p.ripple_id = r.id where r.skill_id = ${skills.id})::int`,
  view_count: sql<number>`(select count(*) from skill_views v where v.skill_id = ${skills.id})::int`,
  comment_count: sql<number>`(select count(*) from skill_comments sc where sc.skill_id = ${skills.id})::int`,
  heat_raw_weekly: sql<number>`(
    (select count(*) from ripples r where r.skill_id = ${skills.id} and r.created_at > ${WEEK}) * 1.0
    + (select count(*) from user_skill_likes l where l.skill_id = ${skills.id} and l.created_at > ${WEEK}) * 2.0
    + (select count(*) from skill_comments sc where sc.skill_id = ${skills.id} and sc.created_at > ${WEEK}) * 4.0
    + (select count(*) from skill_views v where v.skill_id = ${skills.id} and v.created_at > ${WEEK}) * 0.05
  )::float`,
};

const HEAT_EXPR = countsSelection.heat_raw_weekly;

export interface SkillWithCounts {
  skill: SkillRow;
  author: typeof users.$inferSelect;
  counts: SkillCounts;
}

function toCounts(row: Record<string, unknown>): SkillCounts {
  return {
    copy_count: Number(row.copy_count),
    like_count: Number(row.like_count),
    download_count: Number(row.download_count),
    ripple_count: Number(row.ripple_count),
    ripple_reach: Number(row.ripple_reach),
    view_count: Number(row.view_count),
    comment_count: Number(row.comment_count),
    heat_raw_weekly: Number(row.heat_raw_weekly),
  };
}

export interface ListParams extends Partial<SkillListQuery> {
  includeGray?: boolean;
  /** 关注流/互动状态所属用户 */
  userId?: string;
  /** 限定 id 集合（合辑/个人列表用） */
  skillIds?: string[];
  includeAllStatuses?: boolean;
}

export function buildFilters(params: ListParams): SQL[] {
  const filters: SQL[] = [];
  if (!params.includeAllStatuses) filters.push(eq(skills.status, 'active'));
  if (!params.includeGray) filters.push(eq(skills.publish_channel, 'production'));
  if (params.category) filters.push(eq(skills.category, params.category));
  if (params.rating) filters.push(eq(skills.rating, params.rating));
  if (params.origin_type) filters.push(eq(skills.origin_type, params.origin_type));
  if (params.author) filters.push(eq(skills.author_id, params.author));
  if (params.skillIds) filters.push(inArray(skills.id, params.skillIds));
  if (params.tags) {
    for (const tag of params.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)) {
      filters.push(sql`${skills.tags} @> ${JSON.stringify([tag])}::jsonb`);
    }
  }
  if (params.search) {
    const q = `%${params.search}%`;
    filters.push(sql`(
      ${skills.name} ilike ${q}
      or ${skills.display_name} ilike ${q}
      or ${skills.description} ilike ${q}
      or ${skills.id} in (select sf.skill_id from skill_files sf where sf.content ilike ${q})
    )`);
  }
  if (params.sort_by === 'following' && params.userId) {
    filters.push(
      sql`${skills.author_id} in (select uf.followee_id from user_follows uf where uf.follower_id = ${params.userId})`,
    );
  }
  return filters;
}

function orderFor(sortBy: string | undefined): SQL[] {
  switch (sortBy) {
    case 'heat':
      return [sql`${HEAT_EXPR} desc`, desc(skills.created_at)];
    case 'latest':
    case 'created_at':
    case 'following':
      return [desc(skills.created_at)];
    case 'updated_at':
      return [desc(skills.updated_at)];
    case 'recommended':
    default:
      // 热度×0.7 + 新鲜度加权（对齐原型推荐排序）
      return [
        sql`(${HEAT_EXPR} * 0.7 + greatest(0, 2000 - extract(epoch from (now() - ${skills.created_at})) / 60) * 0.02) desc`,
        desc(skills.created_at),
      ];
  }
}

export async function listSkills(
  db: Db,
  params: ListParams,
): Promise<{ items: SkillWithCounts[]; total: number }> {
  const filters = buildFilters(params);
  const where = filters.length ? and(...filters) : undefined;
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 20;

  const totalRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(skills)
    .where(where);
  const total = totalRows[0]?.count ?? 0;

  const rows = await db
    .select({ skill: skills, author: users, ...countsSelection })
    .from(skills)
    .innerJoin(users, eq(skills.author_id, users.id))
    .where(where)
    .orderBy(...orderFor(params.sort_by))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    items: rows.map((row) => ({ skill: row.skill, author: row.author, counts: toCounts(row) })),
    total,
  };
}

export async function getSkillWithCounts(
  db: Db,
  where: SQL,
): Promise<SkillWithCounts | null> {
  const rows = await db
    .select({ skill: skills, author: users, ...countsSelection })
    .from(skills)
    .innerJoin(users, eq(skills.author_id, users.id))
    .where(where)
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { skill: row.skill, author: row.author, counts: toCounts(row) };
}

/** 批量取用户对一组技能的互动状态（4 条常数查询，与技能数无关） */
export async function getEngagements(
  db: Db,
  userId: string,
  skillIds: string[],
): Promise<Map<string, EngagementRow>> {
  const map = new Map<string, EngagementRow>();
  if (skillIds.length === 0) return map;
  const ensure = (id: string): EngagementRow => {
    let row = map.get(id);
    if (!row) {
      row = { copied_at: null, liked_at: null, downloaded_at: null, rippled_at: null };
      map.set(id, row);
    }
    return row;
  };
  const [copies, likes, downloads, rippleRows] = await Promise.all([
    db
      .select({ skill_id: userSkillCopies.skill_id, at: userSkillCopies.created_at })
      .from(userSkillCopies)
      .where(and(eq(userSkillCopies.user_id, userId), inArray(userSkillCopies.skill_id, skillIds))),
    db
      .select({ skill_id: userSkillLikes.skill_id, at: userSkillLikes.created_at })
      .from(userSkillLikes)
      .where(and(eq(userSkillLikes.user_id, userId), inArray(userSkillLikes.skill_id, skillIds))),
    db
      .select({ skill_id: userSkillDownloads.skill_id, at: userSkillDownloads.created_at })
      .from(userSkillDownloads)
      .where(
        and(eq(userSkillDownloads.user_id, userId), inArray(userSkillDownloads.skill_id, skillIds)),
      ),
    db
      .select({ skill_id: ripplesTable.skill_id, at: ripplesTable.created_at })
      .from(ripplesTable)
      .where(and(eq(ripplesTable.sender_id, userId), inArray(ripplesTable.skill_id, skillIds))),
  ]);
  for (const r of copies) ensure(r.skill_id).copied_at = r.at;
  for (const r of likes) ensure(r.skill_id).liked_at = r.at;
  for (const r of downloads) ensure(r.skill_id).downloaded_at = r.at;
  for (const r of rippleRows) ensure(r.skill_id).rippled_at = r.at;
  return map;
}

const WEEKLY_MAX_KEY = 'ripple:heat:weekly_max';
let memoryCache: { value: number; at: number } | null = null;

/** 周归一化基准：全库最大周热度，缓存 1 小时（Redis 优先，内存兜底） */
export async function getWeeklyMaxHeat(db: Db, redis: RedisService): Promise<number> {
  const cached = await redis.getCachedNumber(WEEKLY_MAX_KEY);
  if (cached !== null) return cached;
  if (memoryCache && Date.now() - memoryCache.at < 3600_000) return memoryCache.value;
  const rows = await db
    .select({ max: sql<number>`coalesce(max(${HEAT_EXPR}), 0)::float` })
    .from(skills)
    .where(eq(skills.status, 'active'));
  const value = Number(rows[0]?.max ?? 0);
  memoryCache = { value, at: Date.now() };
  await redis.setCachedNumber(WEEKLY_MAX_KEY, value, 3600);
  return value;
}

export async function followerFeedExists(db: Db, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: userFollows.id })
    .from(userFollows)
    .where(eq(userFollows.follower_id, userId))
    .limit(1);
  return rows.length > 0;
}
