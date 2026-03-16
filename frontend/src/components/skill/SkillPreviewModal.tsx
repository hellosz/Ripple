"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { skills as skillsApi } from "@/lib/api";
import { SkillMarkdown } from "./SkillMarkdown";
import type { SkillDetail } from "@/types";

interface SkillPreviewModalProps {
  slug: string;
  onClose: () => void;
}

export function SkillPreviewModal({ slug, onClose }: SkillPreviewModalProps) {
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await skillsApi.get(slug);
        setDetail(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl border border-white/[0.08] bg-[#16112a] overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white/90 truncate">
            {detail?.display_name || slug}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-5 bg-white/[0.05] rounded w-1/3" />
              <div className="h-3 bg-white/[0.05] rounded w-full" />
              <div className="h-3 bg-white/[0.05] rounded w-4/5" />
              <div className="h-3 bg-white/[0.05] rounded w-2/3" />
              <div className="h-20 bg-white/[0.05] rounded w-full mt-4" />
            </div>
          ) : detail?.content ? (
            <div className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-white/75 prose-li:text-white/75 prose-strong:text-white prose-code:text-emerald-300 prose-pre:bg-black/30 prose-pre:border prose-pre:border-white/[0.08]">
              <SkillMarkdown content={detail.content} />
            </div>
          ) : (
            <p className="text-white/30 text-sm text-center py-8">
              No content available
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
