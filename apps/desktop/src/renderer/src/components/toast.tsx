import type { ReactElement } from 'react';
import { useStore } from '../store.js';
import { INK } from '../ui.js';

export function Toast(): ReactElement | null {
  const { toastMsg } = useStore();
  if (!toastMsg) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 44,
        right: 24,
        zIndex: 60,
        background: '#ffffff',
        border: '1px solid rgba(147,168,107,.4)',
        borderRadius: 11,
        padding: '11px 18px',
        fontSize: 12.5,
        color: INK,
        boxShadow: '0 8px 24px rgba(63,68,56,.12)',
        animation: 'slide-up .25s cubic-bezier(.16,1,.3,1)',
      }}
    >
      {toastMsg}
    </div>
  );
}
