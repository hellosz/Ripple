"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Plus, LogOut, Shield } from "lucide-react";
import { SkillUploadForm } from "@/components/skill/SkillUploadForm";
import { RippleLogo } from "./RippleLogo";

export function Header() {
  const { user, logout, requireAuth } = useAuth();
  const [showUpload, setShowUpload] = useState(false);

  return (
    <>
      <header className="header-aurora sticky top-0 z-40 border-b border-white/[0.06] shadow-[0_6px_24px_rgba(8,5,18,0.18)]">
        <div className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center self-stretch">
            <RippleLogo height={28} />
          </Link>

          <nav className="flex h-full items-center gap-2">
            <button
              onClick={() => requireAuth(() => setShowUpload(true))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70"
              title="Upload Skill"
            >
              <Plus size={18} />
            </button>

            {user ? (
              <div className="flex items-center gap-1">
                <Link
                  href="/user/profile"
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/[0.06]"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ripple-500/20 text-xs font-medium text-ripple-300">
                    {user.nickname?.[0] || user.email[0].toUpperCase()}
                  </div>
                  <span className="hidden sm:inline">
                    {user.nickname || user.email.split("@")[0]}
                  </span>
                </Link>
                {user.role === "admin" && (
                  <Link
                    href="/admin"
                    className="rounded-md p-1.5 text-white/30 transition-colors hover:bg-white/[0.04] hover:text-white/60"
                    title="Admin"
                  >
                    <Shield size={15} />
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="rounded-md p-1.5 text-white/30 transition-colors hover:bg-white/[0.04] hover:text-white/60"
                  title="Logout"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => requireAuth(() => {})}
                className="rounded-md px-2 py-1.5 text-sm text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white/80"
              >
                Login
              </button>
            )}
          </nav>
        </div>
      </header>

      {showUpload && (
        <SkillUploadForm
          onClose={() => setShowUpload(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </>
  );
}
