import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildZip } from '@ripple/skill-core';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { loadConfig } from './config.js';
import { buildApp, createDeps, type AppDeps } from './app.js';
import { upgrade } from './db/migrator.js';
import { users, ripplePushes, guestSessions } from './db/schema.js';
import { drainPendingPushes } from './services/ripple-service.js';
import type { StorageService } from './services/storage.js';

const ADMIN_URL = process.env.RIPPLE_TEST_ADMIN_DATABASE_URL ?? '';
const TEST_DB = 'ripple_ts_test';

const enabled = Boolean(ADMIN_URL);

function skillZip(opts: {
  name: string;
  description?: string;
  extraFiles?: Record<string, string>;
  body?: string;
  version?: string;
}): Uint8Array {
  const description =
    opts.description ??
    '一个足够长的技能描述，用来满足评级器对描述长度的基本要求，超过五十个字符以便测试各评级路径。';
  const md = [
    '---',
    `name: ${opts.name}`,
    `description: ${description}`,
    `version: ${opts.version ?? '1.0.0'}`,
    '---',
    '',
    `# ${opts.name}`,
    opts.body ?? '## Workflow\nsteps\n## Usage\nu\n## FAQ\nf',
  ].join('\n');
  return buildZip({ 'SKILL.md': md, ...(opts.extraFiles ?? {}) });
}

function multipartBody(
  data: Uint8Array,
  fields: Record<string, string>,
): { payload: Buffer; headers: Record<string, string> } {
  const boundary = '----ripple-test-boundary';
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
      ),
    );
  }
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="skill.zip"\r\nContent-Type: application/zip\r\n\r\n`,
    ),
  );
  parts.push(Buffer.from(data));
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(parts),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

describe.skipIf(!enabled)('server API 集成测试（真实 PostgreSQL）', () => {
  let app: FastifyInstance;
  let deps: AppDeps;
  let adminToken: string;
  let userToken: string;
  let userId: string;
  let secondAdminToken: string;

  const packages = new Map<string, Uint8Array>();

  beforeAll(async () => {
    // 1. 重建测试库并迁移到 head
    const admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${TEST_DB}`);
    await admin.end();
    const testUrl = ADMIN_URL.replace(/\/[^/]*$/, `/${TEST_DB}`);
    await upgrade(testUrl);

    // 2. 构建应用（对象存储用内存桩、SMTP/LLM 走降级路径）
    const config = loadConfig({
      ...process.env,
      DATABASE_URL: testUrl,
      SMTP_HOST: '',
      OPENAI_API_KEY: '',
      APP_BASE_URL: 'http://test.local',
      REDIS_URL: process.env.RIPPLE_TEST_REDIS_URL ?? 'redis://localhost:6379/1',
      ADMIN_EMAIL: 'admin@test.local',
    });
    deps = createDeps(config);
    deps.storage = {
      ensureBucket: async () => {},
      putPackage: async (key: string, data: Uint8Array) => {
        packages.set(key, data);
      },
      getPackage: async (key: string) => packages.get(key) ?? null,
      bucket: 'test',
    } as unknown as StorageService;
    app = await buildApp(deps);

    // 3. 准备账号：admin（ADMIN_EMAIL 自动 admin）、普通用户、第二 admin
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'admin@test.local' } });
    await deps.db
      .update(users)
      .set({ password_hash: (await import('./plugins/auth.js')).hashPassword('pw-admin') })
      .where(eq(users.email, 'admin@test.local'));
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@test.local', password: 'pw-admin' },
    });
    adminToken = adminLogin.json().access_token as string;

    const auth = await import('./plugins/auth.js');
    const userRows = await deps.db
      .insert(users)
      .values({ email: 'user@test.local', password_hash: auth.hashPassword('pw-user') })
      .returning();
    userId = userRows[0]!.id;
    const userLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'user@test.local', password: 'pw-user' },
    });
    userToken = userLogin.json().access_token as string;

    await deps.db
      .insert(users)
      .values({
        email: 'admin2@test.local',
        password_hash: auth.hashPassword('pw-admin2'),
        role: 'admin',
      })
      .returning();
    const admin2Login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin2@test.local', password: 'pw-admin2' },
    });
    secondAdminToken = admin2Login.json().access_token as string;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await deps?.redis.close();
    await deps?.pool.end();
  });

  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

  describe('认证', () => {
    it('重复注册同邮箱返回 409', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'admin@test.local' },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('email_taken');
    });

    it('错误密码返回 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'user@test.local', password: 'wrong' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('ADMIN_EMAIL 注册自动 admin', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(adminToken) });
      expect(res.json().role).toBe('admin');
    });

    it('禁用用户访问需登录接口返回 403', async () => {
      const auth = await import('./plugins/auth.js');
      const rows = await deps.db
        .insert(users)
        .values({
          email: 'disabled@test.local',
          password_hash: auth.hashPassword('pw'),
          status: 'active',
        })
        .returning();
      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'disabled@test.local', password: 'pw' },
      });
      const token = login.json().access_token as string;
      await deps.db.update(users).set({ status: 'disabled' }).where(eq(users.id, rows[0]!.id));
      const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(token) });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('技能上传与读取', () => {
    it('admin 上传合法包成功并返回评级', async () => {
      const { payload, headers } = multipartBody(
        skillZip({
          name: 'git-archaeologist',
          extraFiles: { 'references/unique-marker.md': '# 内含独特词 archaeology-deep-dive' },
        }),
        { category: 'GitHub 工作流', recommendation: '考古必备', origin_type: 'original' },
      );
      const res = await app.inject({
        method: 'POST',
        url: '/api/skills',
        headers: { ...bearer(adminToken), ...headers },
        payload,
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.rating).toMatch(/^[SABC]$/);
      expect(body.install_command).toBe('ripple install git-archaeologist');
      expect(packages.size).toBeGreaterThan(0);
    });

    it('普通用户上传返回 403', async () => {
      const { payload, headers } = multipartBody(skillZip({ name: 'nope' }), {
        category: 'x',
        recommendation: 'x',
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/skills',
        headers: { ...bearer(userToken), ...headers },
        payload,
      });
      expect(res.statusCode).toBe(403);
    });

    it('冒名更新他人技能返回 409', async () => {
      const { payload, headers } = multipartBody(skillZip({ name: 'git-archaeologist' }), {
        category: 'x',
        recommendation: 'x',
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/skills',
        headers: { ...bearer(secondAdminToken), ...headers },
        payload,
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('name_taken');
    });

    it('缺 SKILL.md 的包被拒绝', async () => {
      const { payload, headers } = multipartBody(buildZip({ 'README.md': 'x' }), {
        category: 'x',
        recommendation: 'x',
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/skills',
        headers: { ...bearer(adminToken), ...headers },
        payload,
      });
      expect(res.statusCode).toBe(400);
    });

    it('正文全文搜索命中 references 内独特词', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/skills?search=archaeology-deep-dive' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.items.map((i: { name: string }) => i.name)).toContain('git-archaeologist');
    });

    it('详情返回 content 与 heat 字段', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/skills/git-archaeologist' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.content).toContain('## Workflow');
      expect(body.stats.heat).toBeGreaterThanOrEqual(0);
      expect(body.stats.heat).toBeLessThanOrEqual(100);
    });

    it('文件树与单文件内容', async () => {
      const tree = await app.inject({ method: 'GET', url: '/api/skills/git-archaeologist/files' });
      expect(tree.statusCode).toBe(200);
      const names = JSON.stringify(tree.json());
      expect(names).toContain('SKILL.md');
      expect(names).toContain('references');

      const file = await app.inject({
        method: 'GET',
        url: '/api/skills/git-archaeologist/files/references/unique-marker.md',
      });
      expect(file.statusCode).toBe(200);
      expect(file.json().content).toContain('archaeology-deep-dive');
      expect(file.json().language).toBe('markdown');
    });

    it('未知技能 404', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/skills/does-not-exist' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('灰度发布', () => {
    it('灰度技能对匿名隐藏、admin 可见', async () => {
      const { payload, headers } = multipartBody(skillZip({ name: 'gray-skill' }), {
        category: 'x',
        recommendation: 'x',
        publish_channel: 'gray',
      });
      const up = await app.inject({
        method: 'POST',
        url: '/api/skills',
        headers: { ...bearer(adminToken), ...headers },
        payload,
      });
      expect(up.statusCode).toBe(201);

      const anon = await app.inject({ method: 'GET', url: '/api/skills?search=gray-skill' });
      expect(anon.json().items).toHaveLength(0);
      const anonDetail = await app.inject({ method: 'GET', url: '/api/skills/gray-skill' });
      expect(anonDetail.statusCode).toBe(404);

      const admin = await app.inject({
        method: 'GET',
        url: '/api/skills?search=gray-skill',
        headers: bearer(adminToken),
      });
      expect(admin.json().items).toHaveLength(1);
    });
  });

  describe('下载', () => {
    it('原包存在时返回 ZIP 并记录下载', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/skills/git-archaeologist/download',
        headers: bearer(userToken),
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/zip');
      const mine = await app.inject({
        method: 'GET',
        url: '/api/users/me/downloads',
        headers: bearer(userToken),
      });
      expect(mine.json().map((s: { name: string }) => s.name)).toContain('git-archaeologist');
    });

    it('原包缺失时回退 skill_files 打包', async () => {
      packages.clear();
      const res = await app.inject({ method: 'GET', url: '/api/skills/git-archaeologist/download' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/zip');
      expect(res.rawPayload.length).toBeGreaterThan(100);
    });
  });

  describe('互动与 RP 前置', () => {
    it('未 copy 直接 ripple 被拒', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/skills/git-archaeologist/ripple',
        headers: bearer(userToken),
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('copy_required');
    });

    it('copy 幂等、like 重复 400、满足前置后 ripple 成功且唯一', async () => {
      const copy1 = await app.inject({
        method: 'POST',
        url: '/api/skills/git-archaeologist/copy',
        headers: bearer(userToken),
      });
      expect(copy1.statusCode).toBe(200);
      expect(copy1.json().command).toBe('ripple install git-archaeologist');
      const copy2 = await app.inject({
        method: 'POST',
        url: '/api/skills/git-archaeologist/copy',
        headers: bearer(userToken),
      });
      expect(copy2.statusCode).toBe(200);

      const like = await app.inject({
        method: 'POST',
        url: '/api/skills/git-archaeologist/like',
        headers: bearer(userToken),
      });
      expect(like.statusCode).toBe(200);
      const likeAgain = await app.inject({
        method: 'POST',
        url: '/api/skills/git-archaeologist/like',
        headers: bearer(userToken),
      });
      expect(likeAgain.statusCode).toBe(400);
      expect(likeAgain.json().error.code).toBe('already_liked');

      const stats = await app.inject({
        method: 'GET',
        url: '/api/skills/git-archaeologist/stats',
        headers: bearer(userToken),
      });
      expect(stats.json().engagement_state.ripple_available).toBe(true);

      const ripple = await app.inject({
        method: 'POST',
        url: '/api/skills/git-archaeologist/ripple',
        headers: bearer(userToken),
        payload: { comment: '好用！' },
      });
      expect(ripple.statusCode).toBe(200);
      expect(ripple.json().push_count).toBeGreaterThanOrEqual(0);

      const again = await app.inject({
        method: 'POST',
        url: '/api/skills/git-archaeologist/ripple',
        headers: bearer(userToken),
        payload: {},
      });
      expect(again.statusCode).toBe(400);
      expect(again.json().error.code).toBe('already_rippled');
    });

    it('离线目标 pending，drain 后置 shown，consume 置 consumed', async () => {
      const pushes = await deps.db.select().from(ripplePushes);
      const mine = pushes.filter((p) => p.target_user_id && p.status === 'pending');
      expect(mine.length).toBeGreaterThan(0);
      const targetId = mine[0]!.target_user_id!;

      const notifications = await drainPendingPushes(deps.db, targetId);
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0]!.type).toBe('ripple');

      // 目标用户登录后 consume
      const targetRows = await deps.db.select().from(users).where(eq(users.id, targetId)).limit(1);
      const auth = await import('./plugins/auth.js');
      const token = await auth.signToken(targetRows[0]!.id, deps.config);
      const deliveryId = notifications[0]!.type === 'ripple' ? notifications[0]!.delivery_id : '';
      const consume = await app.inject({
        method: 'POST',
        url: `/api/ripples/deliveries/${deliveryId}/consume`,
        headers: bearer(token),
      });
      expect(consume.statusCode).toBe(200);
      const after = await deps.db
        .select()
        .from(ripplePushes)
        .where(eq(ripplePushes.id, deliveryId));
      expect(after[0]!.status).toBe('consumed');
      expect(after[0]!.consumed_at).not.toBeNull();
    });
  });

  describe('浏览计数', () => {
    it('同一用户当日重复浏览只计一次', async () => {
      const first = await app.inject({
        method: 'POST',
        url: '/api/skills/git-archaeologist/view',
        headers: bearer(userToken),
      });
      expect(first.json().counted).toBe(true);
      const second = await app.inject({
        method: 'POST',
        url: '/api/skills/git-archaeologist/view',
        headers: bearer(userToken),
      });
      expect(second.json().counted).toBe(false);
      expect(second.json().view_count).toBe(1);
    });

    it('游客按 session 去重', async () => {
      const headers = { 'x-ripple-guest-session': 'guest-view-session-1' };
      const first = await app.inject({
        method: 'POST',
        url: '/api/skills/git-archaeologist/view',
        headers,
      });
      expect(first.json().counted).toBe(true);
      const second = await app.inject({
        method: 'POST',
        url: '/api/skills/git-archaeologist/view',
        headers,
      });
      expect(second.json().counted).toBe(false);
    });
  });

  describe('评论', () => {
    it('发布、嵌套回复与树结构', async () => {
      const c1 = await app.inject({
        method: 'POST',
        url: '/api/skills/git-archaeologist/comments',
        headers: bearer(userToken),
        payload: { content: '顶层评论' },
      });
      expect(c1.statusCode).toBe(201);
      const parentId = c1.json().id as string;
      const c2 = await app.inject({
        method: 'POST',
        url: '/api/skills/git-archaeologist/comments',
        headers: bearer(adminToken),
        payload: { content: '回复', parent_id: parentId },
      });
      expect(c2.statusCode).toBe(201);

      const tree = await app.inject({ method: 'GET', url: '/api/skills/git-archaeologist/comments' });
      const roots = tree.json() as Array<{ id: string; children: Array<{ content: string }> }>;
      const root = roots.find((r) => r.id === parentId)!;
      expect(root.children.map((c) => c.content)).toContain('回复');
    });

    it('匿名发评论 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/skills/git-archaeologist/comments',
        payload: { content: 'x' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('合辑与关注', () => {
    it('admin 建合辑、列表按序返回', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/collections',
        headers: bearer(adminToken),
        payload: {
          slug: 'starter',
          name: '新手上路包',
          description: '先把日常工作跑顺。',
          curator: '官方',
          skill_names: ['git-archaeologist'],
        },
      });
      expect(res.statusCode).toBe(201);
      const list = await app.inject({ method: 'GET', url: '/api/collections' });
      const body = list.json() as Array<{ slug: string; skill_count: number; total_heat: number }>;
      expect(body.find((c) => c.slug === 'starter')?.skill_count).toBe(1);
    });

    it('未知技能名 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/collections',
        headers: bearer(adminToken),
        payload: {
          slug: 'bad',
          name: 'x',
          description: 'x',
          curator: 'x',
          skill_names: ['ghost-skill'],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('关注后关注流只含被关注作者的技能；自关注 400', async () => {
      const adminMe = await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(adminToken) });
      const adminId = adminMe.json().id as string;

      const self = await app.inject({
        method: 'POST',
        url: `/api/users/${userId}/follow`,
        headers: bearer(userToken),
      });
      expect(self.statusCode).toBe(400);

      const follow = await app.inject({
        method: 'POST',
        url: `/api/users/${adminId}/follow`,
        headers: bearer(userToken),
      });
      expect(follow.statusCode).toBe(200);
      expect(follow.json().following).toBe(true);

      const feed = await app.inject({
        method: 'GET',
        url: '/api/skills?sort_by=following',
        headers: bearer(userToken),
      });
      const items = feed.json().items as Array<{ author: { id: string } }>;
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((i) => i.author.id === adminId)).toBe(true);
    });
  });

  describe('管理后台', () => {
    it('非 admin 访问 403', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/admin/stats', headers: bearer(userToken) });
      expect(res.statusCode).toBe(403);
    });

    it('总览统计与 Top 榜', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/admin/stats', headers: bearer(adminToken) });
      expect(res.statusCode).toBe(200);
      expect(res.json().skills.total).toBeGreaterThanOrEqual(2);
      const top = await app.inject({ method: 'GET', url: '/api/admin/stats/top', headers: bearer(adminToken) });
      expect(top.statusCode).toBe(200);
      expect(top.json()).toHaveProperty('top_likes');
    });

    it('禁用用户后其登录访问被拒', async () => {
      const list = await app.inject({
        method: 'GET',
        url: '/api/admin/users?search=user@test.local',
        headers: bearer(adminToken),
      });
      const target = (list.json().items as Array<{ id: string; email: string }>).find(
        (u) => u.email === 'user@test.local',
      )!;
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/users/${target.id}/status`,
        headers: bearer(adminToken),
        payload: { status: 'disabled' },
      });
      expect(res.json().status).toBe('disabled');
      const denied = await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(userToken) });
      expect(denied.statusCode).toBe(403);
      // 恢复
      await app.inject({
        method: 'PATCH',
        url: `/api/admin/users/${target.id}/status`,
        headers: bearer(adminToken),
        payload: { status: 'active' },
      });
    });
  });

  describe('游客会话', () => {
    it('touch 创建会话；注册认领游客投递', async () => {
      const sessionKey = 'guest-claim-session-42';
      const touch = await app.inject({
        method: 'POST',
        url: '/api/ripples/guest-session/touch',
        headers: { 'x-ripple-guest-session': sessionKey },
      });
      expect(touch.statusCode).toBe(200);
      const sessions = await deps.db
        .select()
        .from(guestSessions)
        .where(eq(guestSessions.session_key, sessionKey));
      expect(sessions).toHaveLength(1);

      // 直接给该游客造一条 pending 投递
      const pushRows = await deps.db.select().from(ripplePushes).limit(1);
      expect(pushRows.length).toBeGreaterThan(0);
      await deps.db.insert(ripplePushes).values({
        ripple_id: pushRows[0]!.ripple_id,
        guest_session_id: sessions[0]!.id,
        status: 'pending',
      });

      const reg = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'claimer@test.local' },
        headers: { 'x-ripple-guest-session': sessionKey },
      });
      expect(reg.statusCode).toBe(201);
      const claimerId = reg.json().user.id as string;
      const claimed = await deps.db
        .select()
        .from(ripplePushes)
        .where(eq(ripplePushes.target_user_id, claimerId));
      expect(claimed.length).toBeGreaterThan(0);
      expect(claimed[0]!.guest_session_id).toBeNull();
    });
  });

  describe('设备码流程', () => {
    it('init → confirm → poll 一次性消费', async (ctx) => {
      if (!deps.redis.available) return ctx.skip();
      const init = await app.inject({ method: 'POST', url: '/api/auth/device/init' });
      expect(init.statusCode).toBe(200);
      const { device_code, user_code } = init.json() as {
        device_code: string;
        user_code: string;
      };
      expect(user_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

      const pending = await app.inject({
        method: 'GET',
        url: `/api/auth/device/poll?device_code=${device_code}`,
      });
      expect(pending.json().status).toBe('pending');

      const confirm = await app.inject({
        method: 'POST',
        url: '/api/auth/device/confirm',
        headers: bearer(adminToken),
        payload: { user_code },
      });
      expect(confirm.statusCode).toBe(200);

      const authorized = await app.inject({
        method: 'GET',
        url: `/api/auth/device/poll?device_code=${device_code}`,
      });
      expect(authorized.json().status).toBe('authorized');
      expect(authorized.json().access_token).toBeTruthy();

      const consumed = await app.inject({
        method: 'GET',
        url: `/api/auth/device/poll?device_code=${device_code}`,
      });
      expect(consumed.json().status).toBe('expired');
    });
  });

  describe('个人中心', () => {
    it('资料更新与 AI 画像降级', async () => {
      const update = await app.inject({
        method: 'PUT',
        url: '/api/users/me',
        headers: bearer(userToken),
        payload: { nickname: '林晚', description: '在仓库历史里做考古的人。' },
      });
      expect(update.json().nickname).toBe('林晚');

      const gen = await app.inject({
        method: 'POST',
        url: '/api/users/me/generate-profile',
        headers: bearer(userToken),
      });
      expect(gen.statusCode).toBe(200);
      expect(gen.json().source).toBe('fallback');
      expect(gen.json().candidates).toHaveLength(6);
    });

    it('我的点赞 / 我的 ripple 列表', async () => {
      const likes = await app.inject({
        method: 'GET',
        url: '/api/users/me/likes',
        headers: bearer(userToken),
      });
      expect(likes.json().map((s: { name: string }) => s.name)).toContain('git-archaeologist');

      const myRipples = await app.inject({
        method: 'GET',
        url: '/api/users/me/ripples',
        headers: bearer(userToken),
      });
      expect(myRipples.json().length).toBeGreaterThan(0);
      expect(myRipples.json()[0].pushes).toBeDefined();
    });
  });
});
