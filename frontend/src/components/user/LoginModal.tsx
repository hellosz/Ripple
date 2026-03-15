"use client";

import { useState } from "react";
import { X, Mail, Lock } from "lucide-react";
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isNewUser ? "Create Account" : "Login to Ripple"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleEmailSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.name@patpat.com"
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-ripple-500"
                required
              />
            </div>
          </div>

          {!isNewUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-ripple-500"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 rounded-lg p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-ripple-500 text-white font-medium hover:bg-ripple-600 disabled:opacity-50 transition-colors"
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
              className="text-sm text-ripple-600 dark:text-ripple-400 hover:underline"
            >
              {isNewUser
                ? "Already have an account? Login"
                : "New here? Create account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
