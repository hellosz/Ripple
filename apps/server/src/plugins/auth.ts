import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db/client.js';
import { users } from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import type { AppConfig } from '../config.js';

export type DbUser = typeof users.$inferSelect;

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: DbUser | null;
  }
}

export async function signToken(userId: string, config: AppConfig): Promise<string> {
  const secret = new TextEncoder().encode(config.JWT_SECRET_KEY);
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: config.JWT_ALGORITHM })
    .setExpirationTime(`${config.JWT_EXPIRE_DAYS}d`)
    .setIssuedAt()
    .sign(secret);
}

export async function verifyToken(token: string, config: AppConfig): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(config.JWT_SECRET_KEY);
    const { payload } = await jwtVerify(token, secret, { algorithms: [config.JWT_ALGORITHM] });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export function generateRandomPassword(length = 12): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += PASSWORD_ALPHABET[Math.floor(Math.random() * PASSWORD_ALPHABET.length)];
  }
  return out;
}

const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateUserCode(): string {
  const part = () =>
    Array.from(
      { length: 4 },
      () => USER_CODE_ALPHABET[Math.floor(Math.random() * USER_CODE_ALPHABET.length)],
    ).join('');
  return `${part()}-${part()}`;
}

export async function resolveUser(
  request: FastifyRequest,
  db: Db,
  config: AppConfig,
): Promise<DbUser | null> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const userId = await verifyToken(header.slice(7), config);
  if (!userId) return null;
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}

/** 三档鉴权 preHandler 工厂 */
export function authGuards(db: Db, config: AppConfig) {
  const optionalAuth = async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    request.currentUser = await resolveUser(request, db, config);
    if (request.currentUser && request.currentUser.status === 'disabled') {
      throw AppError.forbidden('Account disabled', 'account_disabled');
    }
  };
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await optionalAuth(request, reply);
    if (!request.currentUser) throw AppError.unauthorized();
  };
  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireAuth(request, reply);
    if (request.currentUser?.role !== 'admin') throw AppError.forbidden('Admin only', 'admin_only');
  };
  return { optionalAuth, requireAuth, requireAdmin };
}

export function guestSessionKey(request: FastifyRequest): string | null {
  const raw = request.headers['x-ripple-guest-session'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  return /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : null;
}
