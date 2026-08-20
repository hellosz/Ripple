import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { ZodError } from 'zod';
import { loadConfig, type AppConfig } from './config.js';
import { createDb, type Db } from './db/client.js';
import type pg from 'pg';
import { AppError } from './lib/errors.js';
import { authGuards } from './plugins/auth.js';
import { RedisService } from './services/redis.js';
import { SseHub } from './services/sse-hub.js';
import { StorageService } from './services/storage.js';
import { MailService } from './services/mail.js';
import { LlmService } from './services/llm.js';
import { MAX_SKILL_ZIP_SIZE } from '@ripple/skill-core';
import { registerMetaRoutes } from './routes/meta.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerUserRoutes } from './routes/users.js';
import { registerSkillRoutes } from './routes/skills.js';
import { registerInteractionRoutes } from './routes/interactions.js';
import { registerRippleRoutes } from './routes/ripples.js';
import { registerSseRoutes } from './routes/sse.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerCollectionRoutes } from './routes/collections.js';

export interface AppDeps {
  config: AppConfig;
  db: Db;
  pool: pg.Pool;
  redis: RedisService;
  hub: SseHub;
  storage: StorageService;
  mailer: MailService;
  llm: LlmService;
}

export function createDeps(config: AppConfig = loadConfig()): AppDeps {
  const { pool, db } = createDb(config.databaseUrl);
  const redis = new RedisService(config.REDIS_URL);
  redis.connect();
  const hub = new SseHub(redis);
  const storage = new StorageService({
    endpoint: config.MINIO_ENDPOINT,
    accessKey: config.MINIO_ACCESS_KEY,
    secretKey: config.MINIO_SECRET_KEY,
    bucket: config.MINIO_BUCKET,
    secure: config.MINIO_SECURE,
  });
  const mailer = new MailService({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    user: config.SMTP_USER,
    password: config.SMTP_PASSWORD,
    from: config.SMTP_FROM,
    appName: config.APP_NAME,
  });
  const llm = new LlmService({ apiKey: config.OPENAI_API_KEY, baseUrl: config.OPENAI_BASE_URL });
  return { config, db, pool, redis, hub, storage, mailer, llm };
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: deps.config.APP_ENV === 'development' ? { level: 'info' } : { level: 'warn' },
    bodyLimit: MAX_SKILL_ZIP_SIZE + 1024 * 1024,
  });

  await app.register(cors, {
    origin: deps.config.corsOrigins,
    credentials: true,
  });
  await app.register(multipart, {
    limits: { fileSize: MAX_SKILL_ZIP_SIZE, files: 1 },
  });

  app.decorateRequest('currentUser', null);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.status)
        .send({ error: { code: error.code, message: error.message } });
    }
    if (error instanceof ZodError) {
      const message = error.issues
        .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
        .join('; ');
      return reply.status(400).send({ error: { code: 'validation', message } });
    }
    const err = error as { statusCode?: number; message?: string };
    const status = typeof err.statusCode === 'number' ? err.statusCode : 500;
    if (status >= 500) app.log.error(error);
    return reply.status(status).send({
      error: {
        code: 'internal',
        message: status >= 500 ? 'Internal server error' : (err.message ?? 'Request error'),
      },
    });
  });

  const guards = authGuards(deps.db, deps.config);

  registerMetaRoutes(app, deps);
  registerAuthRoutes(app, deps, guards);
  registerUserRoutes(app, deps, guards);
  registerSkillRoutes(app, deps, guards);
  registerInteractionRoutes(app, deps, guards);
  registerRippleRoutes(app, deps, guards);
  registerSseRoutes(app, deps);
  registerAdminRoutes(app, deps, guards);
  registerCollectionRoutes(app, deps, guards);

  return app;
}

export type Guards = ReturnType<typeof authGuards>;
