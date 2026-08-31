import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  deviceConfirmInputSchema,
  loginInputSchema,
  registerInputSchema,
} from '@ripple/contract';
import type { AppDeps, Guards } from '../app.js';
import { users } from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import { toUser } from '../lib/serialize.js';
import {
  generateRandomPassword,
  generateUserCode,
  guestSessionKey,
  hashPassword,
  signToken,
  verifyPassword,
} from '../plugins/auth.js';
import { claimGuestSessionDeliveries } from '../services/ripple-service.js';

export function registerAuthRoutes(app: FastifyInstance, deps: AppDeps, guards: Guards): void {
  const { db, config } = deps;

  app.post('/api/auth/register', async (request, reply) => {
    const input = registerInputSchema.parse(request.body);
    const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (existing.length > 0) throw AppError.conflict('Email already registered', 'email_taken');

    const password = generateRandomPassword();
    const role = input.email === config.ADMIN_EMAIL ? 'admin' : 'user';
    const inserted = await db
      .insert(users)
      .values({ email: input.email, password_hash: hashPassword(password), role })
      .returning();
    const user = inserted[0]!;

    await deps.mailer.sendInitialPassword(input.email, password);

    const sessionKey = guestSessionKey(request);
    if (sessionKey) await claimGuestSessionDeliveries(db, sessionKey, user.id);

    return reply.status(201).send({
      user: toUser(user),
      message: 'Registered. Initial password sent to your email.',
    });
  });

  app.post('/api/auth/login', async (request) => {
    const input = loginInputSchema.parse(request.body);
    const rows = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    const user = rows[0];
    if (!user || !verifyPassword(input.password, user.password_hash)) {
      throw AppError.unauthorized('Invalid email or password', 'invalid_credentials');
    }
    if (user.status === 'disabled') throw AppError.forbidden('Account disabled', 'account_disabled');

    const sessionKey = guestSessionKey(request);
    if (sessionKey) await claimGuestSessionDeliveries(db, sessionKey, user.id);

    return {
      access_token: await signToken(user.id, config),
      token_type: 'bearer' as const,
      user: toUser(user),
    };
  });

  app.post('/api/auth/logout', async () => ({ message: 'ok' }));

  app.get('/api/auth/me', { preHandler: guards.requireAuth }, async (request) =>
    toUser(request.currentUser!),
  );

  // ---- 设备码流程 ----

  app.post('/api/auth/device/init', async () => {
    const deviceCode = randomUUID();
    const userCode = generateUserCode();
    const ok = await deps.redis.createDevice(deviceCode, userCode);
    if (!ok) throw new AppError(503, 'redis_unavailable', 'Device flow requires Redis');
    return {
      device_code: deviceCode,
      user_code: userCode,
      verification_url: `${config.FRONTEND_URL}/auth/device?code=${userCode}`,
      expires_in: 600,
      interval: 3,
    };
  });

  app.get('/api/auth/device/poll', async (request) => {
    const { device_code } = z.object({ device_code: z.string() }).parse(request.query);
    const state = await deps.redis.getDevice(device_code);
    if (!state) return { status: 'expired' as const };
    if (state.status === 'authorized' && state.access_token) {
      await deps.redis.consumeDevice(device_code);
      return { status: 'authorized' as const, access_token: state.access_token };
    }
    return { status: 'pending' as const };
  });

  app.post('/api/auth/device/confirm', { preHandler: guards.requireAuth }, async (request) => {
    const input = deviceConfirmInputSchema.parse(request.body);
    const token = await signToken(request.currentUser!.id, config);
    const ok = await deps.redis.authorizeDevice(input.user_code.toUpperCase(), token);
    if (!ok) throw AppError.notFound('Invalid or expired code', 'invalid_user_code');
    return { id: request.currentUser!.id, confirmed: true };
  });
}
