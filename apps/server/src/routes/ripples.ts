import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { AppDeps, Guards } from '../app.js';
import { ripplePushes } from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import { guestSessionKey } from '../plugins/auth.js';
import { touchGuestSession } from '../services/ripple-service.js';

export function registerRippleRoutes(app: FastifyInstance, deps: AppDeps, guards: Guards): void {
  const { db } = deps;

  app.post('/api/ripples/guest-session/touch', async (request) => {
    const sessionKey = guestSessionKey(request);
    if (!sessionKey) throw AppError.badRequest('Missing or invalid guest session', 'invalid_session');
    await touchGuestSession(db, sessionKey);
    return { session_key: sessionKey, active: true };
  });

  async function updatePushStatus(
    deliveryId: string,
    userId: string,
    status: 'consumed' | 'dismissed',
  ) {
    const rows = await db
      .select()
      .from(ripplePushes)
      .where(eq(ripplePushes.id, deliveryId))
      .limit(1);
    const push = rows[0];
    if (!push || push.target_user_id !== userId) throw AppError.notFound('Delivery not found');
    await db
      .update(ripplePushes)
      .set({ status, ...(status === 'consumed' ? { consumed_at: new Date() } : {}) })
      .where(eq(ripplePushes.id, deliveryId));
    return { id: deliveryId, status };
  }

  app.post(
    '/api/ripples/deliveries/:deliveryId/consume',
    { preHandler: guards.requireAuth },
    async (request) => {
      const { deliveryId } = request.params as { deliveryId: string };
      return updatePushStatus(deliveryId, request.currentUser!.id, 'consumed');
    },
  );

  app.post(
    '/api/ripples/deliveries/:deliveryId/dismiss',
    { preHandler: guards.requireAuth },
    async (request) => {
      const { deliveryId } = request.params as { deliveryId: string };
      return updatePushStatus(deliveryId, request.currentUser!.id, 'dismissed');
    },
  );
}
