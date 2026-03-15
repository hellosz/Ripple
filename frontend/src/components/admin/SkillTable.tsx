"use client";

import { useState, useEffect } from "react";
import { admin as adminApi } from "@/lib/api";
import { formatDate, RATING_CONFIG } from "@/lib/utils";
import type { Rating } from "@/types";

export function SkillTable() {
  const [skills, setSkills] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), page_size: "20" };
      if (search) params.search = search;
      const res = await adminApi.skills(params);
      setSkills(res.items);
      setTotal(res.total);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, [page, search]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    try {
      await adminApi.updateSkillStatus(id, newStatus);
      fetchSkills();
    } catch {
      // Ignore
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search by skill name..."
        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Name</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Author</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Rating</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Status</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Version</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Stats</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {skills.map((s) => {
              const ratingConfig = RATING_CONFIG[s.rating as Rating];
              return (
                <tr key={s.id} className="bg-white dark:bg-gray-900">
                  <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{s.display_name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.author_email}</td>
                  <td className="px-4 py-3">
                    <span className={`${ratingConfig?.color}`}>{ratingConfig?.emoji} {ratingConfig?.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      s.status === "active" ? "bg-green-100 text-green-700" :
                      s.status === "disabled" ? "bg-red-100 text-red-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">v{s.version}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <span title="Likes">{s.stats.like_count}L</span>{" / "}
                    <span title="Downloads">{s.stats.download_count}D</span>{" / "}
                    <span title="Ripples">{s.stats.ripple_count}R</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleStatus(s.id, s.status)}
                      className="text-xs text-ripple-600 hover:underline"
                    >
                      {s.status === "active" ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-50">Prev</button>
          <span className="px-3 py-1.5 text-sm text-gray-500">Page {page}/{Math.ceil(total / 20)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
