'use client';

import { useEffect } from 'react';
import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-context';

const NAV = [
  { href: '/admin', name: '总览' },
  { href: '/admin/skills', name: '技能管理' },
  { href: '/admin/users', name: '用户管理' },
];

/** 管理后台：非 admin 自动跳回首页 */
export default function AdminLayout({ children }: { children: ReactNode }): ReactElement | null {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && (!user || user.role !== 'admin')) router.replace('/');
  }, [ready, user, router]);

  if (!ready || !user || user.role !== 'admin') {
    return (
      <div style={{ textAlign: 'center', padding: '96px 0', color: 'rgba(75,80,64,.4)', fontSize: 13 }}>
        校验身份中…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 32px 72px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: 'var(--rp-ink)' }}>管理后台</h1>
        <nav style={{ display: 'flex', gap: 6, fontSize: 13.5 }}>
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  color: active ? 'var(--rp-ink)' : 'rgba(75,80,64,.55)',
                  fontWeight: active ? 700 : 400,
                  background: active ? 'rgba(63,68,56,.06)' : undefined,
                }}
              >
                {n.name}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
