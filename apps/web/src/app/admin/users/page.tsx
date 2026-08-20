'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { AdminUser } from '@ripple/contract';
import { RippleApiError } from '@ripple/api-client';
import { apiClient } from '@/lib/api';
import { useToast } from '@/components/providers/toast-context';

export default function AdminUsersPage(): ReactElement {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const load = useCallback(async (q: string, p: number) => {
    try {
      const res = await apiClient().admin.users({ search: q || undefined, page: p, page_size: pageSize });
      setItems(res.items);
      setTotal(res.total);
      setPage(p);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(search.trim(), 1), 250);
    return () => window.clearTimeout(t);
  }, [search, load]);

  const toggleStatus = async (u: AdminUser) => {
    const next = u.status === 'active' ? 'disabled' : 'active';
    try {
      const updated = await apiClient().admin.setUserStatus(u.id, next);
      setItems((prev) => prev.map((it) => (it.id === u.id ? updated : it)));
      showToast(`${updated.email} 已${next === 'active' ? '启用' : '停用'}`);
    } catch (e) {
      showToast(e instanceof RippleApiError ? e.message : '更新失败');
    }
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜索邮箱 / 昵称…"
        className="rp-input"
        style={{ width: 320, marginBottom: 16 }}
      />
      <table className="rp-table">
        <thead>
          <tr>
            <th>邮箱</th>
            <th>昵称</th>
            <th>角色</th>
            <th>状态</th>
            <th>注册时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((u) => (
            <tr key={u.id}>
              <td style={{ color: 'var(--rp-ink)' }}>{u.email}</td>
              <td>{u.nickname ?? '—'}</td>
              <td>{u.role === 'admin' ? '管理员' : '用户'}</td>
              <td>
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 9px',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                    background: u.status === 'active' ? 'rgba(22,163,74,.1)' : 'rgba(180,95,74,.12)',
                    color: u.status === 'active' ? '#16a34a' : '#b45f4a',
                  }}
                >
                  {u.status === 'active' ? '正常' : '已停用'}
                </span>
              </td>
              <td>{u.created_at.slice(0, 10)}</td>
              <td>
                <button
                  type="button"
                  className="rp-btn rp-btn-outline"
                  onClick={() => void toggleStatus(u)}
                  style={{ fontSize: 12, borderRadius: 8, padding: '4px 14px' }}
                >
                  {u.status === 'active' ? '停用' : '启用'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'rgba(75,80,64,.4)' }}>
          没有匹配的用户
        </div>
      ) : null}
      {pages > 1 ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <button
            type="button"
            className="rp-btn rp-btn-outline"
            disabled={page <= 1}
            onClick={() => void load(search.trim(), page - 1)}
            style={{ fontSize: 12.5, borderRadius: 8, padding: '5px 14px' }}
          >
            上一页
          </button>
          <span style={{ fontSize: 12.5, color: 'rgba(75,80,64,.5)' }}>
            {page} / {pages}
          </span>
          <button
            type="button"
            className="rp-btn rp-btn-outline"
            disabled={page >= pages}
            onClick={() => void load(search.trim(), page + 1)}
            style={{ fontSize: 12.5, borderRadius: 8, padding: '5px 14px' }}
          >
            下一页
          </button>
        </div>
      ) : null}
    </div>
  );
}
