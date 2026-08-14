"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Heart, Copy, Download } from "lucide-react";
import type { SkillListItem } from "@/types";
import { interactions, skills as skillsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CATEGORY_LABELS } from "@/lib/utils";
import { SkillPreviewModal } from "./SkillPreviewModal";
import { navigateWithTransition } from "@/lib/navigation";

interface SkillCardProps {
  skill: SkillListItem;
  index: number;
}

export function SkillCard({ skill, index }: SkillCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const { requireAuth } = useAuth();
  const router = useRouter();
  const href = `/skill/${skill.name}`;

  const categoryLabel = skill.category ? CATEGORY_LABELS[skill.category] || skill.category : null;
  const authorInitial = skill.author?.nickname?.[0] || skill.author?.email?.[0]?.toUpperCase() || "?";
  const authorName = skill.author?.nickname || skill.author?.email?.split("@")[0] || "Unknown";

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    void navigator.clipboard.writeText(skill.install_command);
    requireAuth(async () => {
      try {
        await interactions.copy(skill.name);
      } catch {
        // Ignore interaction persistence failures from the list card.
      }
    });
  };

  const handleNavigate = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    navigateWithTransition(router, href);
  };

  const handlePrefetch = () => {
    void skillsApi.prefetch(skill.name);
  };

  return (
    <>
      <div
        className="group rounded-2xl border border-white/[0.12] bg-white/[0.03] overflow-hidden transition-all hover:border-white/[0.2] hover:bg-white/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.35)] card-fade-in"
        style={{ animationDelay: `${index * 60}ms` }}
      >
        {/* Top bar: category badge + action buttons */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          {/* Category badge */}
          {categoryLabel ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] text-[11px] text-white/70">
              {categoryLabel}
            </span>
          ) : (
            <span />
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setShowPreview(true)}
              className="p-1.5 rounded-lg text-white/60 hover:text-ripple-400 hover:bg-white/[0.06] transition-colors"
              title="Preview"
            >
              <Eye size={14} />
            </button>
            <button
              className="p-1.5 rounded-lg text-white/60 hover:text-pink-400 hover:bg-white/[0.06] transition-colors"
              title="Favorite"
            >
              <Heart size={14} />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-white/60 hover:text-green-400 hover:bg-white/[0.06] transition-colors"
              title="Copy install command"
            >
              <Copy size={14} />
            </button>
            <button
              className="p-1.5 rounded-lg text-white/60 hover:text-blue-400 hover:bg-white/[0.06] transition-colors"
              title="Install"
            >
              <Download size={14} />
            </button>
          </div>
        </div>

        {/* Main content — clickable to detail page */}
        <Link
          href={href}
          onClick={handleNavigate}
          onMouseEnter={handlePrefetch}
          onFocus={handlePrefetch}
          className="block px-5 pb-4"
        >
          {/* Name + description */}
          <h3 className="font-semibold text-[15px] text-white/90 group-hover:text-ripple-400 transition-colors leading-snug">
            {skill.display_name || skill.name}
          </h3>
          {skill.description && (
            <p className="mt-1.5 text-[13px] text-white/60 line-clamp-2 leading-relaxed">
              {skill.description}
            </p>
          )}

          {/* Author + recommendation bubble */}
          <div className="mt-3 flex items-start gap-2.5">
            {/* Avatar */}
            <div className="w-6 h-6 rounded-full bg-ripple-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[10px] font-medium text-ripple-300">
                {authorInitial}
              </span>
            </div>

            {/* Recommendation bubble or author name */}
            {skill.recommendation ? (
              <div className="min-w-0 flex-1">
                <div className="relative bg-white/[0.04] rounded-lg rounded-tl-sm px-3 py-2">
                  <p className="text-[12px] text-white/60 line-clamp-2 leading-relaxed italic">
                    &ldquo;{skill.recommendation}&rdquo;
                  </p>
                </div>
                <span className="text-[11px] text-white/60 mt-1 inline-block">
                  {authorName}
                </span>
              </div>
            ) : (
              <div className="min-w-0 flex-1 flex items-center h-6">
                <span className="text-[12px] text-white/60">
                  {authorName}
                </span>
              </div>
            )}
          </div>
        </Link>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <SkillPreviewModal
          slug={skill.name}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}
