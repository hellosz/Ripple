'use client';

import { useEffect } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number | string;
  /** 面板对齐：center 居中；top 顶部偏移（搜索浮层样式） */
  align?: 'center' | 'top';
  panelStyle?: CSSProperties;
  /** 是否渲染默认白底面板，false 时 children 自行控制面板 */
  bare?: boolean;
  zIndex?: number;
}

/** 通用弹窗：遮罩 + 毛玻璃 + ESC/点击遮罩关闭 */
export function Modal({
  open,
  onClose,
  children,
  width = 640,
  align = 'center',
  panelStyle,
  bare = false,
  zIndex = 60,
}: ModalProps): ReactElement | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        display: 'flex',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        justifyContent: 'center',
        paddingTop: align === 'top' ? '22vh' : 24,
        padding: align === 'center' ? 24 : undefined,
        background: 'rgba(63,68,56,.35)',
        backdropFilter: 'blur(14px)',
        animation: 'rp-fade-in .2s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={
          bare
            ? { width, maxWidth: '92vw', animation: 'rp-slide-up .3s cubic-bezier(.16,1,.3,1)', ...panelStyle }
            : {
                width,
                maxWidth: '92vw',
                maxHeight: '84vh',
                overflowY: 'auto',
                background: '#ffffff',
                border: '1px solid rgba(147,168,107,.35)',
                borderRadius: 20,
                padding: 32,
                animation: 'rp-slide-up .3s cubic-bezier(.16,1,.3,1)',
                boxShadow: 'var(--rp-shadow-lg)',
                ...panelStyle,
              }
        }
      >
        {children}
      </div>
    </div>
  );
}

export interface ModalCloseButtonProps {
  onClose: () => void;
}

export function ModalCloseButton({ onClose }: ModalCloseButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="关闭"
      className="rp-btn rp-btn-ghost"
      style={{ padding: 8, borderRadius: 10, flex: 'none' }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  );
}
