'use client';

import type { ReactElement, ReactNode } from 'react';

export interface ToastProps {
  children: ReactNode;
  /** 附加操作（如「查看」） */
  actionLabel?: string;
  onAction?: () => void;
}

/** 右下角吐司（展示态组件，队列管理由应用层负责） */
export function Toast({ children, actionLabel, onAction }: ToastProps): ReactElement {
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 28,
        right: 28,
        zIndex: 70,
        background: '#ffffff',
        border: '1px solid rgba(147,168,107,.45)',
        borderRadius: 12,
        padding: '13px 20px',
        fontSize: 13.5,
        color: 'var(--rp-body)',
        boxShadow: '0 8px 24px rgba(63,68,56,.12)',
        animation: 'rp-slide-up .25s cubic-bezier(.16,1,.3,1)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        maxWidth: 'min(420px, calc(100vw - 56px))',
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#6b7f43"
        strokeWidth="2"
        style={{ flex: 'none' }}
      >
        <circle cx="12" cy="12" r="2" />
        <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
        <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
      </svg>
      <span style={{ minWidth: 0 }}>{children}</span>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          style={{
            border: '1px solid rgba(147,168,107,.5)',
            background: 'none',
            color: 'var(--rp-primary)',
            fontSize: 12.5,
            borderRadius: 8,
            padding: '4px 12px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flex: 'none',
            fontFamily: 'var(--rp-font-sans)',
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
