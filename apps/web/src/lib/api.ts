import { RippleClient } from '@ripple/api-client';

export const TOKEN_KEY = 'ripple_token';
export const GUEST_SESSION_KEY = 'ripple_guest_session';
export const AUTH_CHANGED_EVENT = 'ripple-auth-changed';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

/** UUID v4：crypto.randomUUID 仅在安全上下文（HTTPS/localhost）存在，HTTP 内网 IP 访问需降级 */
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 游客会话 UUID：首次访问生成并持久化 */
export function getGuestSession(): string | null {
  if (typeof window === 'undefined') return null;
  let key = window.localStorage.getItem(GUEST_SESSION_KEY);
  if (!key) {
    key = generateUuid();
    window.localStorage.setItem(GUEST_SESSION_KEY, key);
  }
  return key;
}

let client: RippleClient | null = null;

/** 浏览器端统一 RippleClient（走 Next rewrite 的相对 /api） */
export function apiClient(): RippleClient {
  if (!client) {
    client = new RippleClient({
      baseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      getToken,
      getGuestSession,
    });
  }
  return client;
}
