"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { skills as skillsApi } from "@/lib/api";
import { SkillCard } from "./SkillCard";
import type { SkillListItem } from "@/types";
import { RATING_CONFIG, ORIGIN_LABELS, CATEGORY_LABELS } from "@/lib/utils";

const PAGE_SIZE = 12;

interface SkillCardGridProps {
  search?: string;
}

export function SkillCardGrid({ search = "" }: SkillCardGridProps) {
  const [items, setItems] = useState<SkillListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [rating, setRating] = useState("");
  const [originType, setOriginType] = useState("");
  const [page, setPage] = useState(1);
  const [showMore, setShowMore] = useState(false);

  const hasMoreFilters = !!(rating || originType);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        page_size: String(PAGE_SIZE),
        sort_by: "updated_at",
      };
      if (search) params.search = search;
      if (category) params.category = category;
      if (rating) params.rating = rating;
      if (originType) params.origin_type = originType;

      const res = await skillsApi.list(params);
      setItems(res.items);
      setTotal(res.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, category, rating, originType, page]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const clearMoreFilters = () => {
    setRating("");
    setOriginType("");
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const categories = Object.entries(CATEGORY_LABELS);
  const ratings = Object.entries(RATING_CONFIG);
  const origins = Object.entries(ORIGIN_LABELS);

  const pillClass = (active: boolean) =>
    `px-3 py-1.5 text-xs rounded-full border transition-all ${
      active
        ? "border-ripple-500/50 bg-ripple-500/10 text-ripple-300"
        : "border-white/[0.12] text-white/60 hover:border-white/[0.2] hover:text-white/80"
    }`;

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── Feed header: divider + filters ── */}
      <div className="border-t border-white/[0.06] pt-6 mb-6">
        {/* Category tabs + more button */}
        <div className="flex items-center justify-between gap-3">
          {/* Category tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => { setCategory(""); setPage(1); }}
              className={pillClass(!category)}
            >
              All
            </button>
            {categories.map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setCategory(key); setPage(1); }}
                className={pillClass(category === key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Right side: count + more toggle */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/70 tabular-nums">
              {total}
              <span className="text-white/50">skills</span>
            </span>
            <button
              onClick={() => setShowMore(!showMore)}
              className={`rounded-lg border p-1.5 transition-colors ${
                showMore || hasMoreFilters
                  ? "border-ripple-500/40 text-ripple-400 bg-ripple-500/10"
                  : "border-white/[0.12] text-white/60 hover:text-white/80 hover:bg-white/[0.08]"
              }`}
              title="More filters"
            >
              <SlidersHorizontal size={14} />
            </button>
          </div>
        </div>

        {/* Expandable "more" filters */}
        <AnimatePresence>
          {showMore && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-4 pb-1 space-y-2.5">
                {/* Rating */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-white/55 w-12">Rating</span>
                  <button
                    onClick={() => { setRating(""); setPage(1); }}
                    className={pillClass(!rating)}
                  >
                    All
                  </button>
                  {ratings.map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => { setRating(key); setPage(1); }}
                      className={pillClass(rating === key)}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>

                {/* Origin */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-white/55 w-12">Origin</span>
                  <button
                    onClick={() => { setOriginType(""); setPage(1); }}
                    className={pillClass(!originType)}
                  >
                    All
                  </button>
                  {origins.map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setOriginType(key); setPage(1); }}
                      className={pillClass(originType === key)}
                    >
                      {label}
                    </button>
                  ))}

                  {hasMoreFilters && (
                    <button
                      onClick={clearMoreFilters}
                      className="ml-2 text-[11px] text-ripple-400 hover:text-ripple-300 transition-colors flex items-center gap-0.5"
                    >
                      <X size={10} /> Clear
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Feed list: 2-column grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 animate-pulse"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-5 bg-white/[0.05] rounded-full w-20" />
                <div className="flex gap-1">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="w-6 h-6 bg-white/[0.03] rounded-lg" />
                  ))}
                </div>
              </div>
              <div className="h-4 bg-white/[0.05] rounded w-2/3 mb-2" />
              <div className="h-3 bg-white/[0.05] rounded w-full mb-1" />
              <div className="h-3 bg-white/[0.05] rounded w-4/5" />
              <div className="flex items-center gap-2 mt-4">
                <div className="w-6 h-6 rounded-full bg-white/[0.05]" />
                <div className="h-3 bg-white/[0.05] rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-white/60">
          <p className="text-base">No skills found</p>
          <p className="text-sm mt-1 text-white/50">Try a different search or filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((skill, i) => (
            <SkillCard key={skill.id} skill={skill} index={i} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg text-white/60 hover:text-white/80 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-white/60 tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg text-white/60 hover:text-white/80 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
