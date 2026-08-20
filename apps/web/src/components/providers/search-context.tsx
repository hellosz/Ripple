'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

export interface SearchContextValue {
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch 必须在 SearchProvider 内使用');
  return ctx;
}

/** 全局 ⌘K / Ctrl+K 搜索浮层开关 */
export function SearchProvider({ children }: { children: ReactNode }): ReactElement {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <SearchContext.Provider
      value={{ open, openSearch: () => setOpen(true), closeSearch: () => setOpen(false) }}
    >
      {children}
    </SearchContext.Provider>
  );
}
