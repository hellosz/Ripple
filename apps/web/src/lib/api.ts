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

/** 游客会话 UUID：首次访问生成并持久化 */
export function getGuestSession(): string | null {
  if (typeof window === 'undefined') return null;
  let key = window.localStorage.getItem(GUEST_SESSION_KEY);
  if (!key) {
    key = crypto.randomUUID();
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
