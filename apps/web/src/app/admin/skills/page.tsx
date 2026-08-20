'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { AdminSkill, SkillStatus } from '@ripple/contract';
import { RippleApiError } from '@ripple/api-client';
import { apiClient } from '@/lib/api';
import { useToast } from '@/components/providers/toast-context';

const STATUS_OPTIONS: { value: SkillStatus; label: string }[] = [
  { value: 'active', label: '上架' },
  { value: 'hidden', label: '隐藏' },
  { value: 'offline', label: '下线' },
  { value: 'disabled', label: '禁用' },
];

export default function AdminSkillsPage(): ReactElement {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<AdminSkill[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const load = useCallback(async (q: string, p: number) => {
    try {
      const res = await apiClient().admin.skills({ search: q || undefined, page: p, page_size: pageSize });
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

  const setStatus = async (skill: AdminSkill, status: SkillStatus) => {
    try {
      const updated = await apiClient().admin.setSkillStatus(skill.id, status);
      setItems((prev) => prev.map((s) => (s.id === skill.id ? updated : s)));
      showToast(`「${updated.display_name}」状态已更新`);
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
        placeholder="搜索技能名 / 作者…"
        className="rp-input"
        style={{ width: 320, marginBottom: 16 }}
      />
      <table className="rp-table">
        <thead>
          <tr>
            <th>技能</th>
            <th>作者</th>
            <th>评级</th>
            <th>渠道</th>
            <th>热度</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id}>
              <td>
                <div style={{ fontWeight: 700, color: 'var(--rp-ink)' }}>{s.display_name}</div>
                <div style={{ fontFamily: 'var(--rp-font-mono)', fontSize: 11.5, color: 'rgba(75,80,64,.45)' }}>
                  {s.name}
                </div>
              </td>
              <td>{s.author_email}</td>
              <td style={{ fontFamily: 'var(--rp-font-display)', fontWeight: 700 }}>{s.rating}</td>
              <td>
                {s.publish_channel === 'gray' ? (
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 9px',
                      borderRadius: 999,
                      background: 'rgba(180,140,60,.12)',
                      color: '#a3762a',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    灰度
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: 'rgba(75,80,64,.5)' }}>正式</span>
                )}
              </td>
              <td style={{ fontFamily: 'var(--rp-font-display)', color: 'var(--rp-primary)' }}>{s.stats.heat}</td>
              <td>
                <select
                  value={s.status}
                  onChange={(e) => void setStatus(s, e.target.value as SkillStatus)}
                  className="rp-input"
                  style={{ padding: '5px 10px', fontSize: 12.5 }}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'rgba(75,80,64,.4)' }}>
          没有匹配的技能
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
