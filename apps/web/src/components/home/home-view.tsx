'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { EngagementState, SkillListItem, SkillSort, SkillStats } from '@ripple/contract';
import { RippleApiError } from '@ripple/api-client';
import { apiClient } from '@/lib/api';
import { CATEGORIES } from '@/lib/format';
import { useAuth } from '@/components/providers/auth-context';
import { Hero } from './hero';
import { PreviewModal } from './preview-modal';
import { RightRail } from './right-rail';
import { SkillCard } from './skill-card';

const PAGE_SIZE = 10;

const TABS: { name: string; sort: SkillSort }[] = [
  { name: '推荐', sort: 'recommended' },
  { name: '最热', sort: 'heat' },
  { name: '最新', sort: 'latest' },
  { name: '关注', sort: 'following' },
];

/** 首页：Hero + 信息流 + 右栏 */
export function HomeView(): ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const { user, ready } = useAuth();

  const q = params.get('q')?.trim() ?? '';
  const cat = params.get('cat') ?? '';
  const initialTab = params.get('tab') === 'hot' ? '最热' : '推荐';

  const [tab, setTab] = useState(initialTab);
  const [items, setItems] = useState<SkillListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [preview, setPreview] = useState<SkillListItem | null>(null);

  const urlTab = params.get('tab');
  useEffect(() => {
    if (urlTab === 'hot') setTab('最热');
  }, [urlTab]);

  const sort = TABS.find((t) => t.name === tab)?.sort ?? 'recommended';

  const fetchPage = useCallback(
    async (pageNo: number, append: boolean) => {
      setLoading(true);
      setNeedLogin(false);
      try {
        const res = await apiClient().skills.list({
          search: q || undefined,
          category: cat || undefined,
          sort_by: sort,
          page: pageNo,
          page_size: PAGE_SIZE,
        });
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setTotal(res.total);
        setPage(pageNo);
      } catch (e) {
        if (!append) {
          setItems([]);
          setTotal(0);
        }
        if (e instanceof RippleApiError && e.status === 401 && sort === 'following') {
          setNeedLogin(true);
        }
      } finally {
        setLoading(false);
      }
    },
    [q, cat, sort],
  );

  useEffect(() => {
    if (!ready) return;
    void fetchPage(1, false);
  }, [fetchPage, ready, user]);

  const onItemUpdate = useCallback((id: string, stats: SkillStats, engagement: EngagementState) => {
    const update = (it: SkillListItem) =>
      it.id === id ? { ...it, stats, engagement_state: engagement } : it;
    setItems((prev) => prev.map(update));
    setPreview((prev) => (prev && prev.id === id ? { ...prev, stats, engagement_state: engagement } : prev));
  }, []);

  const applyFilters = (nextQ: string, nextCat: string) => {
    const sp = new URLSearchParams();
    if (nextQ) sp.set('q', nextQ);
    if (nextCat) sp.set('cat', nextCat);
    router.push(sp.size > 0 ? `/?${sp.toString()}` : '/');
  };

  const filterNotice =
    q && cat ? `搜索 “${q}” · 分类 ${cat}` : q ? `搜索 “${q}”` : cat ? `分类 ${cat}` : '';

  const hasMore = items.length < total;
  const emptyHint = needLogin
    ? '登录后可以看到关注作者的新分享'
    : tab === '关注'
      ? '关注的作者还没有新分享'
      : '换个关键词或清除筛选试试';

  return (
    <div>
      <Hero searchHint={q ? `搜索：${q}` : undefined} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: 40,
          padding: '32px 32px 72px',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              borderBottom: '1px solid rgba(63,68,56,.08)',
              marginBottom: 4,
            }}
          >
            {TABS.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => setTab(t.name)}
                style={{
                  fontSize: 14,
                  padding: '10px 16px',
                  cursor: 'pointer',
                  border: 'none',
                  background: 'none',
                  fontFamily: 'var(--rp-font-sans)',
                  fontWeight: tab === t.name ? 700 : 400,
                  color: tab === t.name ? 'var(--rp-ink)' : 'rgba(75,80,64,.5)',
                  borderBottom: tab === t.name ? '2px solid var(--rp-primary)' : '2px solid transparent',
                }}
              >
                {t.name}
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: 'rgba(75,80,64,.4)', whiteSpace: 'nowrap' }}>
              {total} 个技能
            </span>
          </div>
          {filterNotice ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 4px 0',
                fontSize: 12.5,
                color: 'rgba(107,127,67,.85)',
              }}
            >
              <span>{filterNotice}</span>
              <button
                type="button"
                onClick={() => applyFilters('', '')}
                style={{
                  color: 'var(--rp-primary)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  border: 'none',
                  background: 'none',
                  fontSize: 12.5,
                  fontFamily: 'var(--rp-font-sans)',
                  padding: 0,
                }}
              >
                清除
              </button>
            </div>
          ) : null}
          {items.map((it, i) => (
            <SkillCard
              key={it.id}
              item={it}
              delay={Math.min(i, 6) * 60}
              onPreview={setPreview}
              onCategory={(c) => applyFilters(q, c)}
              onItemUpdate={onItemUpdate}
            />
          ))}
          {!loading && items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '72px 0', color: 'rgba(75,80,64,.5)' }}>
              <div style={{ fontSize: 15 }}>这里还很安静</div>
              <div style={{ fontSize: 13, marginTop: 6, color: 'rgba(75,80,64,.35)' }}>{emptyHint}</div>
            </div>
          ) : null}
          {loading && items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '72px 0', color: 'rgba(75,80,64,.4)', fontSize: 13 }}>
              涟漪加载中…
            </div>
          ) : null}
          {hasMore ? (
            <div
              onClick={() => void fetchPage(page + 1, true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void fetchPage(page + 1, true);
              }}
              className="rp-row-hover"
              style={{
                textAlign: 'center',
                marginTop: 26,
                padding: 12,
                border: '1px solid rgba(147,168,107,.3)',
                borderRadius: 12,
                fontSize: 13,
                color: 'var(--rp-primary)',
                cursor: 'pointer',
                transition: 'all .2s',
              }}
            >
              {loading ? '加载中…' : '加载更多 · 涟漪不止'}
            </div>
          ) : null}
        </div>
        <RightRail
          activeCategory={cat}
          onCategory={(c) => applyFilters(q, c)}
          categories={[...CATEGORIES]}
        />
      </div>
      <PreviewModal item={preview} onClose={() => setPreview(null)} onItemUpdate={onItemUpdate} />
    </div>
  );
}
