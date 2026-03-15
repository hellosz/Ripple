"use client";

import { useState, useEffect } from "react";
import { admin as adminApi } from "@/lib/api";
import { RATING_CONFIG } from "@/lib/utils";
import type { AdminStats, TopStats, Rating } from "@/types";

export function StatsChart() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [topStats, setTopStats] = useState<TopStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminApi.stats(), adminApi.topStats()])
      .then(([s, t]) => {
        setStats(s);
        setTopStats(t);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />)}
    </div>;
  }

  if (!stats) return <div className="text-gray-500">Failed to load stats</div>;

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "Users", value: stats.users.total, color: "text-blue-600" },
          { label: "Skills", value: stats.skills.total, color: "text-green-600" },
          { label: "Likes", value: stats.interactions.total_likes, color: "text-red-600" },
          { label: "Downloads", value: stats.interactions.total_downloads, color: "text-purple-600" },
          { label: "Ripples", value: stats.interactions.total_ripples, color: "text-ripple-600" },
        ].map((item) => (
          <div key={item.label} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
            <div className="text-xs text-gray-500 mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Rating Distribution */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Rating Distribution</h3>
        <div className="space-y-2">
          {Object.entries(stats.skills.rating_distribution).map(([key, count]) => {
            const config = RATING_CONFIG[key as Rating];
            const pct = stats.skills.total > 0 ? (count / stats.skills.total) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-20 text-sm">{config?.emoji} {config?.label}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      key === "S" ? "bg-green-500" :
                      key === "A" ? "bg-blue-500" :
                      key === "B" ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <span className="w-10 text-sm text-gray-500 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Lists */}
      {topStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: "Top Downloads", data: topStats.top_downloads },
            { title: "Top Likes", data: topStats.top_likes },
            { title: "Top Ripples", data: topStats.top_ripples },
          ].map(({ title, data }) => (
            <div key={title} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{title}</h4>
              <div className="space-y-2">
                {data.length === 0 ? (
                  <p className="text-xs text-gray-400">No data yet</p>
                ) : (
                  data.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 w-5">{i + 1}.</span>
                      <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{item.display_name}</span>
                      <span className="text-gray-500 font-mono">{item.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
