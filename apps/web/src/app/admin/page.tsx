'use client';

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { AdminStats, TopStats } from '@ripple/contract';
import { Card } from '@ripple/ui';
import { apiClient } from '@/lib/api';

export default function AdminOverviewPage(): ReactElement {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [top, setTop] = useState<TopStats | null>(null);

  useEffect(() => {
    void apiClient()
      .admin.stats()
      .then(setStats)
      .catch(() => undefined);
    void apiClient()
      .admin.topStats()
      .then(setTop)
      .catch(() => undefined);
  }, []);

  if (!stats) {
    return <div style={{ color: 'rgba(75,80,64,.4)', fontSize: 13 }}>加载中…</div>;
  }

  const cards = [
    { label: '用户总数', value: stats.users.total },
    { label: '技能总数', value: stats.skills.total },
    { label: '总收藏', value: stats.interactions.total_likes },
    { label: '总下载', value: stats.interactions.total_downloads },
    { label: '总传播', value: stats.interactions.total_ripples },
  ];

  const topLists: { title: string; entries: { name: string; display_name: string; count: number }[] }[] = top
    ? [
        { title: '下载 Top', entries: top.top_downloads },
        { title: '收藏 Top', entries: top.top_likes },
        { title: '传播 Top', entries: top.top_ripples },
      ]
    : [];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
        {cards.map((c) => (
          <Card key={c.label} padding="18px 20px">
            <div style={{ fontFamily: 'var(--rp-font-display)', fontWeight: 700, fontSize: 24, color: 'var(--rp-primary)' }}>
              {c.value}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(75,80,64,.45)', marginTop: 4 }}>{c.label}</div>
          </Card>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 20 }}>
        <Card padding="18px 20px">
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.15em', color: 'rgba(75,80,64,.5)', marginBottom: 10 }}>
            评级分布
          </div>
          {Object.entries(stats.skills.rating_distribution).map(([rating, count]) => (
            <div key={rating} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: 'rgba(75,80,64,.7)' }}>
              <span>{rating}</span>
              <span style={{ fontFamily: 'var(--rp-font-display)' }}>{count}</span>
            </div>
          ))}
        </Card>
        <Card padding="18px 20px">
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.15em', color: 'rgba(75,80,64,.5)', marginBottom: 10 }}>
            来源分布
          </div>
          {Object.entries(stats.skills.origin_distribution).map(([origin, count]) => (
            <div key={origin} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: 'rgba(75,80,64,.7)' }}>
              <span>{origin}</span>
              <span style={{ fontFamily: 'var(--rp-font-display)' }}>{count}</span>
            </div>
          ))}
        </Card>
      </div>
      {topLists.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: 20 }}>
          {topLists.map((list) => (
            <Card key={list.title} padding="18px 20px">
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.15em', color: 'var(--rp-primary)', marginBottom: 10 }}>
                {list.title}
              </div>
              {list.entries.map((e, i) => (
                <div key={e.name} style={{ display: 'flex', gap: 8, fontSize: 13, padding: '4px 0', color: 'rgba(75,80,64,.7)' }}>
                  <span style={{ fontFamily: 'var(--rp-font-display)', color: 'rgba(75,80,64,.35)', width: 16 }}>{i + 1}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.display_name}
                  </span>
                  <span style={{ fontFamily: 'var(--rp-font-display)' }}>{e.count}</span>
                </div>
              ))}
              {list.entries.length === 0 ? (
                <div style={{ fontSize: 12, color: 'rgba(75,80,64,.4)' }}>暂无数据</div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
