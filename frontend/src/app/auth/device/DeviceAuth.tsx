"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function DeviceAuth() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") || "";
  const { user, requireAuth } = useAuth();
  const [status, setStatus] = useState<"idle" | "confirming" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    setStatus("confirming");
    setError("");
    try {
      const token = localStorage.getItem("ripple_token");
      const res = await fetch("/api/auth/device/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_code: code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "授权失败");
      }
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "授权失败");
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-white/[0.12] bg-white/[0.03] p-8 text-center shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
        <h1 className="text-xl font-bold text-white">设备授权</h1>
        <p className="mt-2 text-sm text-white/60">
          在下方验证码确认后，CLI 将获得登录授权
        </p>

        <div className="mt-6 rounded-xl border border-ripple-500/40 bg-ripple-500/10 py-4">
          <div className="text-3xl font-mono font-bold tracking-[0.3em] text-ripple-300">
            {code || "------"}
          </div>
        </div>

        {status === "done" ? (
          <div className="mt-6 rounded-lg border border-green-500/30 bg-green-500/10 py-3 text-sm text-green-300">
            ✓ 授权成功，可以回到命令行继续
          </div>
        ) : status === "error" ? (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : user ? (
          <button
            onClick={handleConfirm}
            disabled={status === "confirming"}
            className="mt-6 w-full rounded-lg bg-ripple-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ripple-400 disabled:opacity-50"
          >
            {status === "confirming" ? "授权中..." : "授权 CLI 登录"}
          </button>
        ) : (
          <button
            onClick={() => requireAuth(() => {})}
            className="mt-6 w-full rounded-lg border border-white/20 bg-white/[0.06] py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.12]"
          >
            请先登录
          </button>
        )}
      </div>
    </div>
  );
}
