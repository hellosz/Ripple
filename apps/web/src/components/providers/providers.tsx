'use client';

import type { ReactElement, ReactNode } from 'react';
import { AuthModal } from '@/components/auth/auth-modal';
import { SearchOverlay } from '@/components/search/search-overlay';
import { AuthProvider } from './auth-context';
import { NotificationProvider } from './notification-provider';
import { SearchProvider } from './search-context';
import { ToastProvider } from './toast-context';

export function Providers({ children }: { children: ReactNode }): ReactElement {
  return (
    <ToastProvider>
      <AuthProvider>
        <SearchProvider>
          <NotificationProvider>
            {children}
            <AuthModal />
            <SearchOverlay />
          </NotificationProvider>
        </SearchProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
