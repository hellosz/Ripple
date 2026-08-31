import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { users } from '../db/schema.js';
import { verifyToken } from '../plugins/auth.js';
import { drainPendingPushes } from '../services/ripple-service.js';

const HEARTBEAT_MS = 30_000;

export function registerSseRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/sse/notifications', async (request, reply) => {
    // EventSource 无法带 header，token 走 query
    const { token } = z.object({ token: z.string() }).parse(request.query);
    const userId = await verifyToken(token, deps.config);
    if (!userId) {
      return reply.status(401).send({ error: { code: 'unauthorized', message: 'Invalid token' } });
    }
    const rows = await deps.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!rows[0] || rows[0].status === 'disabled') {
      return reply.status(403).send({ error: { code: 'forbidden', message: 'Account disabled' } });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    reply.raw.write(': connected\n\n');

    const send = (payload: string) => {
      reply.raw.write(`data: ${payload}\n\n`);
    };
    const unregister = deps.hub.register(userId, send);

    // 补发 pending 投递
    for (const notification of await drainPendingPushes(deps.db, userId)) {
      send(JSON.stringify(notification));
    }

    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, HEARTBEAT_MS);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unregister();
    });

    // 挂起连接：不返回（由客户端断开触发清理）
    await new Promise(() => {
      /* 长连接 */
    });
  });
}
