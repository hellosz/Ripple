"use client";

import { useEffect, useRef, useState } from "react";
import { X, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { auth } from "@/lib/api";

interface LoginModalProps {
  onClose: () => void;
  onSuccess: (token: string) => void;
}

export function LoginModal({ onClose, onSuccess }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.endsWith("@patpat.com")) {
      setError("Only @patpat.com emails are allowed");
      return;
    }

    if (isNewUser) {
      // Register
      setLoading(true);
      setError("");
      try {
        const res = await auth.register(email);
        setRegistrationSuccess(true);
        onSuccess(res.access_token);
      } catch (err: any) {
        if (err.message?.includes("already registered")) {
          setIsNewUser(false);
          setError("Email already registered. Please login.");
        } else {
          setError(err.message || "Registration failed");
        }
      } finally {
        setLoading(false);
      }
    } else {
      // Login
      if (!password) {
        setError("Please enter your password");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await auth.login(email, password);
        onSuccess(res.access_token);
      } catch (err: any) {
        setError(err.message || "Login failed");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter" || loading) return;
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === "button") return;
    e.preventDefault();
    void handleEmailSubmit(e as unknown as React.FormEvent);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      emailInputRef.current?.focus();
    }, 80);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.18),transparent_30%),rgba(10,6,18,0.68)] px-4 backdrop-blur-[6px]"
      initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
      animate={{ opacity: 1, backdropFilter: "blur(6px)" }}
      exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="w-full max-w-[520px] overflow-hidden rounded-[28px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,244,255,0.97)_100%)] shadow-[0_30px_90px_rgba(20,10,35,0.32)]"
        initial={{ opacity: 0, y: 24, scale: 0.96, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: 18, scale: 0.98, filter: "blur(8px)" }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="relative border-b border-[#e7dcf5] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,237,252,0.92)_100%)] px-8 py-7">
          <h2 className="text-center text-[32px] font-semibold tracking-[-0.03em] text-[#1d1630]">
            {isNewUser ? "Create Account" : "Login to Ripple"}
          </h2>
          <div className="mt-3 flex justify-center">
            <div className="h-px w-24 bg-[linear-gradient(90deg,transparent_0%,#cdb8ea_50%,transparent_100%)]" />
          </div>
          <button
            onClick={onClose}
            className="absolute right-5 top-5 rounded-full p-2 text-[#c0b3d6] transition-all duration-200 hover:scale-105 hover:bg-[#f1e8fb] hover:text-[#6f5a96] active:scale-95 active:bg-[#eadcf8]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleEmailSubmit} onKeyDown={handleKeyDown} className="space-y-5 px-8 py-8">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#554b6a]">
              Email
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a194ba]"
              />
              <input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.name@patpat.com"
                className="w-full rounded-2xl border border-[#dacdee] bg-white px-12 py-3.5 text-[15px] text-[#241b38] shadow-[inset_0_1px_2px_rgba(25,12,44,0.04)] outline-none transition-all placeholder:text-[#d2c6e3] focus:border-[#9a7ee0] focus:ring-4 focus:ring-[#8b5cf6]/12"
                required
              />
            </div>
          </div>

          {!isNewUser && (
            <div>
              <label className="mb-2 block text-sm font-medium text-[#554b6a]">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a194ba]"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-2xl border border-[#dacdee] bg-white px-12 py-3.5 pr-12 text-[15px] text-[#241b38] shadow-[inset_0_1px_2px_rgba(25,12,44,0.04)] outline-none transition-all placeholder:text-[#d2c6e3] focus:border-[#9a7ee0] focus:ring-4 focus:ring-[#8b5cf6]/12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#9c8fb5] transition-colors hover:bg-[#f1e8fb] hover:text-[#6f5a96]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[linear-gradient(90deg,#7c4de0_0%,#9a62f6_100%)] py-3.5 text-base font-medium text-white shadow-[0_16px_36px_rgba(124,77,224,0.34)] transition-all duration-200 hover:translate-y-[-1px] hover:scale-[1.01] hover:shadow-[0_20px_42px_rgba(124,77,224,0.42)] active:translate-y-[1px] active:scale-[0.992] active:shadow-[0_10px_24px_rgba(124,77,224,0.28)] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0"
          >
            {loading
              ? "Processing..."
              : isNewUser
              ? "Create Account"
              : "Login"}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsNewUser(!isNewUser);
                setError("");
              }}
              className="text-sm font-medium text-[#7c4de0] transition-colors hover:text-[#6339c3]"
            >
              {isNewUser
                ? "Already have an account? Login"
                : "New here? Create account"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
