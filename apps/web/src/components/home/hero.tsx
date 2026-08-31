'use client';

import type { ReactElement } from 'react';
import { useSearch } from '@/components/providers/search-context';
import { useRippleCanvas } from './use-ripple-canvas';

/** 首页 Hero：主标题 + 水波 canvas + 大搜索框 */
export function Hero({ searchHint }: { searchHint?: string }): ReactElement {
  const canvasRef = useRippleCanvas();
  const { openSearch } = useSearch();

  return (
    <section
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '76px 32px 56px',
        textAlign: 'center',
        background: 'var(--rp-panel)',
        borderBottom: '1px solid rgba(63,68,56,.06)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg,rgba(241,239,228,.5) 0%,rgba(250,249,242,.97) 94%)',
          pointerEvents: 'none',
        }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
      <h1
        style={{
          position: 'relative',
          margin: 0,
          fontFamily: 'var(--rp-font-display)',
          fontWeight: 700,
          fontSize: 'clamp(48px,7vw,76px)',
          lineHeight: 1.08,
          letterSpacing: '-.02em',
          pointerEvents: 'none',
        }}
      >
        <span style={{ color: 'var(--rp-ink)' }}>One Drop,</span>
        <br />
        <span
          style={{
            background: 'var(--rp-gradient-text)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Endless Ripples.
        </span>
      </h1>
      <p
        style={{
          position: 'relative',
          margin: '22px auto 0',
          fontSize: 16,
          color: 'var(--rp-muted)',
          maxWidth: 500,
          lineHeight: 1.8,
          pointerEvents: 'none',
        }}
      >
        每一个被分享的技能，都会在社区里激起看不见的涟漪。
      </p>
      <div
        onClick={openSearch}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') openSearch();
        }}
        style={{
          position: 'relative',
          margin: '34px auto 0',
          maxWidth: 640,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(255,255,255,.75)',
          border: '1px solid rgba(147,168,107,.4)',
          borderRadius: 16,
          padding: '16px 22px',
          boxShadow: '0 2px 12px rgba(63,68,56,.05)',
          backdropFilter: 'blur(8px)',
          cursor: 'pointer',
          transition: 'all .25s',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(107,127,67,.7)" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span style={{ flex: 1, fontSize: 15, color: 'rgba(75,80,64,.4)', textAlign: 'left' }}>
          {searchHint ?? '搜索技能、作者或场景…'}
        </span>
        <span
          style={{
            fontSize: 12,
            color: 'rgba(75,80,64,.35)',
            border: '1px solid rgba(63,68,56,.15)',
            borderRadius: 6,
            padding: '3px 8px',
            fontFamily: 'var(--rp-font-display)',
          }}
        >
          ⌘K
        </span>
      </div>
    </section>
  );
}
