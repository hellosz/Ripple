'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Toast } from '@ripple/ui';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastContextValue {
  showToast: (message: string, action?: ToastAction, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const [toast, setToast] = useState<{ message: string; action?: ToastAction } | null>(null);
  const timer = useRef<number | null>(null);

  const showToast = useCallback((message: string, action?: ToastAction, durationMs = 2600) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setToast({ message, action });
    timer.current = window.setTimeout(() => setToast(null), action ? Math.max(durationMs, 6000) : durationMs);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <Toast
          actionLabel={toast.action?.label}
          onAction={() => {
            toast.action?.onAction();
            setToast(null);
          }}
        >
          {toast.message}
        </Toast>
      ) : null}
    </ToastContext.Provider>
  );
}
