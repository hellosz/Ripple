"use client";

import { useState, useEffect } from "react";
import { admin as adminApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export function UserTable() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), page_size: "20" };
      if (search) params.search = search;
      const res = await adminApi.users(params);
      setUsers(res.items);
      setTotal(res.total);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    try {
      await adminApi.updateUserStatus(id, newStatus);
      fetchUsers();
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
        placeholder="Search by email or nickname..."
        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Email</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Nickname</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Role</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Status</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Created</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
              <tr key={user.id} className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 text-gray-900 dark:text-white">{user.email}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{user.nickname || "-"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    user.role === "admin" ? "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    user.status === "active" ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300" : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(user.created_at)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleStatus(user.id, user.status)}
                    className="text-xs text-ripple-600 hover:underline"
                  >
                    {user.status === "active" ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
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
