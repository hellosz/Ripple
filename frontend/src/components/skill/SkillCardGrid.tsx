"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { skills as skillsApi } from "@/lib/api";
import { SkillCard } from "./SkillCard";
import { SearchBar } from "@/components/layout/SearchBar";
import type { SkillListItem } from "@/types";
import { RATING_CONFIG, ORIGIN_LABELS, CATEGORY_LABELS } from "@/lib/utils";

const PAGE_SIZE = 18;

export function SkillCardGrid() {
  const [items, setItems] = useState<SkillListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [rating, setRating] = useState("");
  const [originType, setOriginType] = useState("");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = !!(category || rating || originType);

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
      // Ignore errors
    } finally {
      setLoading(false);
    }
  }, [search, category, rating, originType, page]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const clearAllFilters = () => {
    setCategory("");
    setRating("");
    setOriginType("");
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const categories = Object.entries(CATEGORY_LABELS);
  const ratings = Object.entries(RATING_CONFIG);
  const origins = Object.entries(ORIGIN_LABELS);

  const filterBtnClass = (active: boolean) =>
    `px-2.5 py-1 text-xs rounded-full border transition-colors ${
      active
        ? "border-ripple-500/50 bg-ripple-500/10 text-ripple-300"
        : "border-white/[0.08] text-white/35 hover:border-white/[0.15] hover:text-white/50"
    }`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Centered search bar — 3/5 screen width */}
      <div className="w-3/5 min-w-[280px] mx-auto">
        <SearchBar
          value={search}
          onChange={handleSearch}
          placeholder="Search skills..."
          expandable
        />
      </div>

      {/* Filter toggle */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-sm text-white/30 hover:text-white/50 transition-colors flex items-center gap-1.5"
        >
          Filters
          {hasActiveFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-ripple-500" />
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-ripple-400 hover:text-ripple-300 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Collapsible filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pb-2">
              {/* Category */}
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <span className="text-xs text-white/20 mr-1">Category:</span>
                <button
                  onClick={() => { setCategory(""); setPage(1); }}
                  className={filterBtnClass(!category)}
                >
                  All
                </button>
                {categories.map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setCategory(key); setPage(1); }}
                    className={filterBtnClass(category === key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Rating */}
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <span className="text-xs text-white/20 mr-1">Rating:</span>
                <button
                  onClick={() => { setRating(""); setPage(1); }}
                  className={filterBtnClass(!rating)}
                >
                  All
                </button>
                {ratings.map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => { setRating(key); setPage(1); }}
                    className={filterBtnClass(rating === key)}
                  >
                    {config.emoji} {config.label}
                  </button>
                ))}
              </div>

              {/* Origin */}
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <span className="text-xs text-white/20 mr-1">Origin:</span>
                <button
                  onClick={() => { setOriginType(""); setPage(1); }}
                  className={filterBtnClass(!originType)}
                >
                  All
                </button>
                {origins.map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setOriginType(key); setPage(1); }}
                    className={filterBtnClass(originType === key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      <div className="text-center">
        <span className="text-xs text-white/20">
          {total} skill{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Card grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 animate-pulse"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.05]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/[0.05] rounded w-2/3" />
                  <div className="h-3 bg-white/[0.05] rounded w-full" />
                  <div className="h-3 bg-white/[0.05] rounded w-4/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <p className="text-base">No skills found</p>
          <p className="text-sm mt-1">Try a different search or filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg text-white/30 hover:text-white/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-white/30 tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg text-white/30 hover:text-white/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
