'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import type { SkillListItem } from '@ripple/contract';
import { TagChip } from '@ripple/ui';
import { apiClient } from '@/lib/api';
import { useSearch } from '@/components/providers/search-context';

/** ⌘K 搜索浮层：输入即时匹配，Enter 应用到信息流，ESC 关闭 */
export function SearchOverlay(): ReactElement | null {
  const { open, closeSearch } = useSearch();
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [results, setResults] = useState<SkillListItem[]>([]);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void apiClient()
        .skills.list({ search: draft.trim() || undefined, page_size: 6 })
        .then((page) => {
          if (!cancelled) {
            setResults(page.items);
            setSearched(true);
          }
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, draft]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch();
      if (e.key === 'Enter') {
        const q = draft.trim();
        closeSearch();
        router.push(q ? `/?q=${encodeURIComponent(q)}` : '/');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, draft, closeSearch, router]);

  if (!open) return null;

  return (
    <div
      onClick={closeSearch}
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '28vh',
        background: 'rgba(63,68,56,.35)',
        backdropFilter: 'blur(16px)',
        animation: 'rp-fade-in .25s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="搜索"
        style={{ width: '75vw', maxWidth: 760, animation: 'rp-slide-up .3s cubic-bezier(.16,1,.3,1)' }}
      >
        <div style={{ position: 'relative' }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(75,80,64,.5)"
            strokeWidth="2"
            style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="搜索技能、作者或场景…"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '16px 52px',
              borderRadius: 999,
              border: '1px solid rgba(147,168,107,.6)',
              background: '#fdfcf7',
              color: 'var(--rp-ink)',
              fontSize: 16,
              outline: 'none',
              boxShadow: '0 0 30px rgba(147,168,107,.2)',
              fontFamily: 'var(--rp-font-sans)',
            }}
          />
          <button
            type="button"
            aria-label="清空"
            onClick={() => setDraft('')}
            style={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              padding: 6,
              borderRadius: '50%',
              cursor: 'pointer',
              color: 'rgba(75,80,64,.4)',
              display: 'flex',
              border: 'none',
              background: 'none',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div
          style={{
            marginTop: 14,
            background: '#fdfcf7',
            border: '1px solid rgba(63,68,56,.1)',
            borderRadius: 16,
            overflow: 'hidden',
            maxHeight: '44vh',
            overflowY: 'auto',
          }}
        >
          {results.map((s) => (
            <div
              key={s.id}
              onClick={() => {
                closeSearch();
                router.push(`/skill/${s.name}`);
              }}
              className="rp-row-hover"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 20px',
                cursor: 'pointer',
                borderBottom: '1px solid rgba(63,68,56,.05)',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--rp-ink)', whiteSpace: 'nowrap' }}>
                {s.display_name}
              </span>
              {s.category ? <TagChip>{s.category}</TagChip> : null}
              <span
                style={{
                  flex: 1,
                  fontSize: 12.5,
                  color: 'rgba(75,80,64,.5)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.description}
              </span>
              <span
                style={{
                  fontFamily: 'var(--rp-font-display)',
                  fontSize: 12,
                  color: 'var(--rp-primary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.stats.heat}
              </span>
            </div>
          ))}
          {searched && draft.trim() !== '' && results.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'rgba(75,80,64,.4)' }}>
              没有匹配的技能，换个关键词试试
            </div>
          ) : null}
        </div>
        <p style={{ textAlign: 'center', color: 'rgba(250,249,242,.75)', fontSize: 12, marginTop: 14 }}>
          Enter 应用到信息流 · ESC 关闭
        </p>
      </div>
    </div>
  );
}
