'use client';

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import type { Collection } from '@ripple/contract';
import { TagChip } from '@ripple/ui';
import { apiClient } from '@/lib/api';
import { copyText } from '@/lib/format';
import { useToast } from '@/components/providers/toast-context';

const DEFAULT_GRADIENT = 'linear-gradient(90deg,#6b7f43,#b9c69a)';

export default function CollectionsPage(): ReactElement {
  const router = useRouter();
  const { showToast } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    void apiClient()
      .collections.list()
      .then(setCollections)
      .catch(() => setCollections([]))
      .finally(() => setLoading(false));
  }, []);

  const installAll = async (co: Collection) => {
    const script = co.skills.map((s) => s.install_command).join('\n');
    await copyText(script);
    showToast(`已复制整套安装脚本（${co.skills.length} 个技能）`);
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '44px 32px 72px', animation: 'rp-fade-in .25s ease-out' }}>
      <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.3em', color: 'var(--rp-primary)' }}>
        COLLECTIONS
      </div>
      <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, color: 'var(--rp-ink)' }}>合辑</h1>
      <p style={{ margin: '10px 0 32px', fontSize: 14.5, color: 'var(--rp-muted)', lineHeight: 1.8, maxWidth: 560 }}>
        由社区策展人围绕一类工作流打包的技能组合 —— 一次装齐，成套生效。
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {collections.map((co) => (
          <div
            key={co.id}
            style={{
              border: '1px solid rgba(63,68,56,.1)',
              borderRadius: 18,
              overflow: 'hidden',
              background: 'rgba(63,68,56,.02)',
              transition: 'all .2s',
            }}
          >
            <div style={{ height: 6, background: co.gradient ?? DEFAULT_GRADIENT }} />
            <div style={{ padding: '22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontWeight: 900, fontSize: 19, color: 'var(--rp-ink)', whiteSpace: 'nowrap' }}>
                  {co.name}
                </span>
                <TagChip>{co.skill_count} 个技能</TagChip>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.75, color: 'var(--rp-muted)' }}>
                {co.description}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, color: 'rgba(75,80,64,.45)' }}>
                <span style={{ whiteSpace: 'nowrap' }}>{co.curator} 策展</span>
                <span>·</span>
                <span style={{ whiteSpace: 'nowrap' }}>总热度 {co.total_heat}</span>
                <span style={{ flex: 1 }} />
                <button
                  type="button"
                  className="rp-btn rp-btn-primary"
                  onClick={() => void installAll(co)}
                  style={{ fontSize: 12.5, borderRadius: 9, padding: '7px 16px' }}
                >
                  装齐整套
                </button>
                <button
                  type="button"
                  className="rp-btn rp-btn-outline"
                  onClick={() => setExpanded(expanded === co.id ? null : co.id)}
                  style={{ fontSize: 12.5, borderRadius: 9, padding: '6px 14px' }}
                >
                  {expanded === co.id ? '收起' : '查看清单'}
                </button>
              </div>
              {expanded === co.id ? (
                <div style={{ marginTop: 16, borderTop: '1px solid rgba(63,68,56,.07)', paddingTop: 6 }}>
                  {co.skills.map((sk) => (
                    <div
                      key={sk.id}
                      className="rp-row-hover"
                      onClick={() => router.push(`/skill/${sk.name}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 6px',
                        cursor: 'pointer',
                        borderRadius: 8,
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--rp-ink)', whiteSpace: 'nowrap' }}>
                        {sk.display_name}
                      </span>
                      {sk.category ? <TagChip>{sk.category}</TagChip> : null}
                      <span
                        style={{
                          flex: 1,
                          fontSize: 12,
                          color: 'rgba(75,80,64,.45)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {sk.description}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--rp-font-display)',
                          fontSize: 12,
                          color: 'var(--rp-primary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {sk.stats.heat}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {!loading && collections.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '72px 0', color: 'rgba(75,80,64,.5)' }}>
          <div style={{ fontSize: 15 }}>这里还很安静</div>
          <div style={{ fontSize: 13, marginTop: 6, color: 'rgba(75,80,64,.35)' }}>还没有策展合辑</div>
        </div>
      ) : null}
    </div>
  );
}
