"use client";

import { useState, useEffect, useCallback } from "react";
import { auth as authApi, ripples as rippleApi } from "@/lib/api";
import { setToken, removeToken, getToken } from "@/lib/auth";
import { connectSSE, disconnectSSE } from "@/lib/sse";
import type { User } from "@/types";

export function useAuthProvider() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const userData = await authApi.me();
      setUser(userData);
      connectSSE();
    } catch {
      removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    return () => disconnectSSE();
  }, [refreshUser]);

  useEffect(() => {
    if (user) {
      return;
    }

    rippleApi.touchGuestSession().catch(() => {});
    const interval = window.setInterval(() => {
      rippleApi.touchGuestSession().catch(() => {});
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [user]);

  const login = useCallback(
    (token: string) => {
      setToken(token);
      refreshUser().then(() => {
        if (pendingAction) {
          pendingAction();
          setPendingAction(null);
        }
        setShowLogin(false);
      });
    },
    [refreshUser, pendingAction]
  );

  const logout = useCallback(() => {
    removeToken();
    disconnectSSE();
    setUser(null);
  }, []);

  const requireAuth = useCallback(
    (callback: () => void) => {
      if (user) {
        callback();
      } else {
        setPendingAction(() => callback);
        setShowLogin(true);
      }
    },
    [user]
  );

  return {
    user,
    loading,
    login,
    logout,
    refreshUser,
    requireAuth,
    showLogin,
    setShowLogin,
  };
}
