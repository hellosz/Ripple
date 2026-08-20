'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { User } from '@ripple/contract';
import { apiClient, getToken, setToken } from '@/lib/api';

export interface AuthContextValue {
  user: User | null;
  /** 首次身份判定是否完成 */
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string) => Promise<string>;
  logout: () => void;
  /** 本地更新用户（资料编辑后） */
  updateUser: (user: User) => void;
  authModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  /** 已登录返回 true；未登录弹出登录框并返回 false */
  requireAuth: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (!getToken()) {
        if (!cancelled) {
          setUser(null);
          setReady(true);
        }
        return;
      }
      try {
        const me = await apiClient().auth.me();
        if (!cancelled) setUser(me);
      } catch {
        setToken(null);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient().auth.login(email, password);
    setToken(res.access_token);
    setUser(res.user);
    setAuthModalOpen(false);
  }, []);

  const register = useCallback(async (email: string) => {
    const res = await apiClient().auth.register(email);
    return res.message;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const requireAuth = useCallback(() => {
    if (user) return true;
    setAuthModalOpen(true);
    return false;
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        login,
        register,
        logout,
        updateUser: setUser,
        authModalOpen,
        openAuthModal: () => setAuthModalOpen(true),
        closeAuthModal: () => setAuthModalOpen(false),
        requireAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
