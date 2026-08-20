import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// 自动加载 apps/server/.env（存在时）
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  /* 无 .env 时使用进程环境与默认值 */
}

const envSchema = z.object({
  // 键名对齐旧 backend/.env
  DATABASE_URL: z.string().default('postgresql+asyncpg://ripple:ripple@localhost:5432/ripple'),
  PORT: z.coerce.number().int().default(8000),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET_KEY: z.string().default('your-secret-key-change-this'),
  JWT_ALGORITHM: z.literal('HS256').default('HS256'),
  JWT_EXPIRE_DAYS: z.coerce.number().default(7),
  ADMIN_EMAIL: z.string().default('admin@patpat.com'),
  ADMIN_PASSWORD: z.string().default('admin123456'),
  MINIO_ENDPOINT: z.string().default('localhost:9000'),
  MINIO_ACCESS_KEY: z.string().default('ripple'),
  MINIO_SECRET_KEY: z.string().default('ripple123456'),
  MINIO_BUCKET: z.string().default('ripple-skill-packages'),
  MINIO_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  LLM_PROVIDER: z.string().default('openai'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_FROM: z.string().default(''),
  CORS_ORIGINS: z.string().default('["http://localhost:3000"]'),
  APP_NAME: z.string().default('Ripple'),
  APP_ENV: z.string().default('development'),
  APP_BASE_URL: z.string().default('http://localhost:8000'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  CLI_VERSION: z.string().default('1.0.0'),
  CLI_NPM_PACKAGE: z.string().default('@hellosz/ripple'),
  REDIS_URL: z.string().default('redis://localhost:6379/0'),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.parse(env);
  return {
    ...parsed,
    /** pg 连接串（兼容旧 postgresql+asyncpg:// 写法） */
    databaseUrl: parsed.DATABASE_URL.replace(/^postgresql\+asyncpg:/, 'postgresql:'),
    corsOrigins: parseCorsOrigins(parsed.CORS_ORIGINS),
  };
}

function parseCorsOrigins(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((o): o is string => typeof o === 'string');
  } catch {
    /* 逗号分隔回退 */
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
