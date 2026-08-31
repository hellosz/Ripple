'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Avatar, RippleLogo } from '@ripple/ui';
import { displayName } from '@/lib/format';
import { useAuth } from '@/components/providers/auth-context';
import { useSearch } from '@/components/providers/search-context';
import { useToast } from '@/components/providers/toast-context';

interface NavItem {
  name: string;
  href: string;
  isActive: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { name: '发现', href: '/', isActive: (p) => p === '/' },
  { name: '榜单', href: '/?tab=hot', isActive: () => false },
  { name: '合辑', href: '/collections', isActive: (p) => p.startsWith('/collections') },
  { name: '文档', href: '/docs/overview', isActive: (p) => p.startsWith('/docs') },
];

/** 全局 Header：Logo、导航、⌘K 搜索、发布入口、头像 */
export function Header(): ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const { user, openAuthModal } = useAuth();
  const { openSearch } = useSearch();
  const { showToast } = useToast();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        overflow: 'hidden',
        background: '#ffffff',
        borderBottom: '1px solid rgba(63,68,56,.1)',
        boxShadow: 'var(--rp-shadow-sm)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '-50% -20%',
          background:
            'radial-gradient(ellipse 60% 160% at 20% 120%,rgba(147,168,107,.10) 0%,transparent 60%),radial-gradient(ellipse 50% 200% at 60% 140%,rgba(185,198,154,.08) 0%,transparent 55%)',
          animation: 'rp-aurora-drift 8s ease-in-out infinite alternate',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          height: 64,
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RippleLogo />
            <span
              style={{
                fontFamily: 'var(--rp-font-display)',
                fontWeight: 700,
                fontSize: 20,
                color: 'var(--rp-ink)',
              }}
            >
              Ripple
            </span>
          </Link>
          <nav style={{ display: 'flex', gap: 6, fontSize: 14, whiteSpace: 'nowrap' }}>
            {NAV_ITEMS.map((n) => {
              const active = n.isActive(pathname);
              return (
                <Link
                  key={n.name}
                  href={n.href}
                  className="rp-navlink"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    color: active ? 'var(--rp-ink)' : 'rgba(75,80,64,.55)',
                    fontWeight: active ? 500 : 400,
                    background: active ? 'rgba(63,68,56,.06)' : undefined,
                  }}
                >
                  {n.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={openSearch}
            className="rp-search-trigger"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid rgba(63,68,56,.15)',
              borderRadius: 999,
              padding: '7px 14px',
              width: 190,
              minWidth: 120,
              color: 'rgba(75,80,64,.4)',
              fontSize: 13,
              background: 'rgba(63,68,56,.04)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--rp-font-sans)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            搜索
            <span style={{ flex: 1 }} />
            <span
              style={{
                fontFamily: 'var(--rp-font-display)',
                fontSize: 11,
                border: '1px solid rgba(63,68,56,.15)',
                borderRadius: 5,
                padding: '1px 6px',
              }}
            >
              ⌘K
            </span>
          </button>
          <button
            type="button"
            onClick={() => showToast('网页发布入口即将开放 — 现在可用 CLI：ripple publish ./my-skill')}
            className="rp-btn rp-btn-primary"
            style={{ fontSize: 13, borderRadius: 999, padding: '8px 18px', flex: 'none' }}
          >
            + 发布技能
          </button>
          <Avatar
            name={user ? displayName(user) : '?'}
            size={32}
            title={user ? '个人中心' : '登录 / 注册'}
            onClick={() => {
              if (user) router.push('/me');
              else openAuthModal();
            }}
          />
        </div>
      </div>
    </header>
  );
}
