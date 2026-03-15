"use client";

import { useState, useEffect, useCallback } from "react";
import { skills as skillsApi } from "@/lib/api";
import { SkillListItemComponent } from "./SkillListItem";
import { SearchBar } from "@/components/layout/SearchBar";
import type { SkillListItem } from "@/types";
import { RATING_CONFIG, ORIGIN_LABELS, CATEGORY_LABELS } from "@/lib/utils";

export function SkillList() {
  const [items, setItems] = useState<SkillListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [rating, setRating] = useState("");
  const [originType, setOriginType] = useState("");
  const [sortBy, setSortBy] = useState("updated_at");
  const [page, setPage] = useState(1);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        page_size: "20",
        sort_by: sortBy,
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
  }, [search, category, rating, originType, sortBy, page]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleTagClick = (tag: string) => {
    setSearch(tag);
    setPage(1);
  };

  const categories = Object.entries(CATEGORY_LABELS);
  const ratings = Object.entries(RATING_CONFIG);
  const origins = Object.entries(ORIGIN_LABELS);

  return (
    <div className="space-y-6">
      {/* Search */}
      <SearchBar value={search} onChange={handleSearch} />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Category filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500 mr-1">Category:</span>
          <button
            onClick={() => { setCategory(""); setPage(1); }}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              !category
                ? "border-ripple-500 bg-ripple-50 dark:bg-ripple-950 text-ripple-600"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
            }`}
          >
            All
          </button>
          {categories.map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setCategory(key); setPage(1); }}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                category === key
                  ? "border-ripple-500 bg-ripple-50 dark:bg-ripple-950 text-ripple-600"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Rating filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500 mr-1">Rating:</span>
          <button
            onClick={() => { setRating(""); setPage(1); }}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              !rating
                ? "border-ripple-500 bg-ripple-50 dark:bg-ripple-950 text-ripple-600"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
            }`}
          >
            All
          </button>
          {ratings.map(([key, config]) => (
            <button
              key={key}
              onClick={() => { setRating(key); setPage(1); }}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                rating === key
                  ? "border-ripple-500 bg-ripple-50 dark:bg-ripple-950 text-ripple-600"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
              }`}
            >
              {config.emoji} {config.label}
            </button>
          ))}
        </div>

        {/* Origin filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500 mr-1">Origin:</span>
          <button
            onClick={() => { setOriginType(""); setPage(1); }}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              !originType
                ? "border-ripple-500 bg-ripple-50 dark:bg-ripple-950 text-ripple-600"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
            }`}
          >
            All
          </button>
          {origins.map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setOriginType(key); setPage(1); }}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                originType === key
                  ? "border-ripple-500 bg-ripple-50 dark:bg-ripple-950 text-ripple-600"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {total} skill{total !== 1 ? "s" : ""} found
        </span>
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
        >
          <option value="updated_at">Latest Updated</option>
          <option value="created_at">Newest</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full mt-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No skills found</p>
          <p className="text-sm">Try a different search or filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((skill) => (
            <SkillListItemComponent
              key={skill.id}
              skill={skill}
              onTagClick={handleTagClick}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
