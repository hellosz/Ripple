'use client';

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import type { SkillListItem } from '@ripple/contract';
import { Chip } from '@ripple/ui';
import { apiClient } from '@/lib/api';

export interface RightRailProps {
  categories: string[];
  activeCategory: string;
  onCategory: (category: string) => void;
}

/** 首页右栏：热度榜 Top5 + 分类 chips + 社区寄语卡 */
export function RightRail({ categories, activeCategory, onCategory }: RightRailProps): ReactElement {
  const router = useRouter();
  const [rank, setRank] = useState<SkillListItem[]>([]);

  useEffect(() => {
    void apiClient()
      .skills.heatRank(5)
      .then(setRank)
      .catch(() => setRank([]));
  }, []);

  const todayRipples = 208 + rank.reduce((a, b) => a + (b.stats.ripple_count % 7), 0);

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 22, position: 'sticky', top: 88, alignSelf: 'start' }}>
      <div
        style={{
          border: '1px solid rgba(147,168,107,.25)',
          borderRadius: 14,
          padding: 20,
          background: 'linear-gradient(150deg,rgba(147,168,107,.1),rgba(147,168,107,.05))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.2em', color: 'var(--rp-primary)' }}>
            热度榜
          </span>
          <span style={{ fontSize: 10, color: 'rgba(75,80,64,.35)' }}>传播·收藏·评论·查询 加权</span>
        </div>
        {rank.map((r, i) => (
          <div
            key={r.id}
            onClick={() => router.push(`/skill/${r.name}`)}
            className="rp-row-hover"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 6px',
              fontSize: 13,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--rp-font-display)',
                fontWeight: 700,
                color: i < 2 ? 'var(--rp-primary)' : 'rgba(75,80,64,.3)',
                width: 16,
              }}
            >
              {i + 1}
            </span>
            <span
              style={{
                flex: 1,
                color: 'var(--rp-ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {r.display_name}
            </span>
            <span
              style={{
                fontFamily: 'var(--rp-font-display)',
                fontSize: 12,
                color: 'var(--rp-primary)',
                whiteSpace: 'nowrap',
              }}
            >
              {r.stats.heat}
            </span>
          </div>
        ))}
        {rank.length === 0 ? (
          <div style={{ fontSize: 12, color: 'rgba(75,80,64,.4)', padding: '8px 6px' }}>榜单虚位以待</div>
        ) : null}
      </div>
      <div style={{ border: '1px solid rgba(63,68,56,.1)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.2em', color: 'rgba(75,80,64,.45)', marginBottom: 14 }}>
          分类
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Chip active={activeCategory === ''} onClick={() => onCategory('')}>
            全部
          </Chip>
          {categories.map((name) => (
            <Chip key={name} active={activeCategory === name} onClick={() => onCategory(name)}>
              {name}
            </Chip>
          ))}
        </div>
      </div>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(63,68,56,.1)',
          borderRadius: 14,
          padding: 20,
          fontSize: 12,
          lineHeight: 1.8,
          background: 'linear-gradient(180deg,rgba(38,46,38,.85),rgba(38,46,38,.95))',
        }}
      >
        <div style={{ position: 'relative', color: '#faf9f2', fontSize: 14, fontStyle: 'italic', lineHeight: 1.7 }}>
          “独行者速，众行者远。”
        </div>
        <div style={{ position: 'relative', marginTop: 8, color: 'rgba(250,249,242,.75)' }}>
          今日社区寄语 · 已激起 {todayRipples} 次涟漪
        </div>
      </div>
    </aside>
  );
}
