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
      <header className="header-aurora sticky top-0 z-40 border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between relative z-10">
          <Link href="/" className="flex items-center">
            <RippleLogo height={28} />
          </Link>

          <nav className="flex items-center gap-2">
            <button
              onClick={() => requireAuth(() => setShowUpload(true))}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
              title="Upload Skill"
            >
              <Plus size={18} />
            </button>

            {user ? (
              <div className="flex items-center gap-1">
                <Link
                  href="/user/profile"
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-white/70 hover:bg-white/[0.06] transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-ripple-500/20 flex items-center justify-center text-xs font-medium text-ripple-300">
                    {user.nickname?.[0] || user.email[0].toUpperCase()}
                  </div>
                  <span className="hidden sm:inline">
                    {user.nickname || user.email.split("@")[0]}
                  </span>
                </Link>
                {user.role === "admin" && (
                  <Link
                    href="/admin"
                    className="p-1.5 text-white/30 hover:text-white/60 transition-colors"
                    title="Admin"
                  >
                    <Shield size={15} />
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="p-1.5 text-white/30 hover:text-white/60 transition-colors"
                  title="Logout"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => requireAuth(() => {})}
                className="text-sm text-white/50 hover:text-white/80 transition-colors"
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
