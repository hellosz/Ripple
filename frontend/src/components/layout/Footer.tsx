"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-8 mt-16">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-white/20">
          Ripple — AI Skill Sharing Platform
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/guide"
            className="text-sm text-white/20 hover:text-white/50 transition-colors"
          >
            Guide
          </Link>
        </nav>
      </div>
    </footer>
  );
}
