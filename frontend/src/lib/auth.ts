"use client";

import { createContext, useContext } from "react";
import type { User } from "@/types";

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  requireAuth: (callback: () => void) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
  requireAuth: () => {},
});

const GUEST_SESSION_STORAGE_KEY = "ripple_guest_session";

export function useAuth() {
  return useContext(AuthContext);
}

export function setToken(token: string) {
  localStorage.setItem("ripple_token", token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ripple_token");
}

export function getGuestSessionKey(): string | null {
  if (typeof window === "undefined") return null;

  const existing = localStorage.getItem(GUEST_SESSION_STORAGE_KEY);
  if (existing) return existing;

  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now()}${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(GUEST_SESSION_STORAGE_KEY, generated);
  return generated;
}

export function removeToken() {
  localStorage.removeItem("ripple_token");
}
