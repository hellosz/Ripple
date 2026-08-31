import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Header } from './header';
import { renderWithProviders } from '@/test/helpers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api', () => ({
  apiClient: () => ({}),
  getToken: () => null,
  setToken: vi.fn(),
  getGuestSession: () => 'guest-session-test',
  TOKEN_KEY: 'ripple_token',
  GUEST_SESSION_KEY: 'ripple_guest_session',
  AUTH_CHANGED_EVENT: 'ripple-auth-changed',
}));

describe('Header', () => {
  it('渲染 Logo 与四个导航项', () => {
    renderWithProviders(<Header />);
    expect(screen.getByText('Ripple')).toBeInTheDocument();
    for (const name of ['发现', '榜单', '合辑', '文档']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('导航项指向正确路由', () => {
    renderWithProviders(<Header />);
    expect(screen.getByText('发现').closest('a')).toHaveAttribute('href', '/');
    expect(screen.getByText('榜单').closest('a')).toHaveAttribute('href', '/?tab=hot');
    expect(screen.getByText('合辑').closest('a')).toHaveAttribute('href', '/collections');
    expect(screen.getByText('文档').closest('a')).toHaveAttribute('href', '/docs/overview');
  });

  it('包含 ⌘K 搜索入口与发布按钮', () => {
    renderWithProviders(<Header />);
    expect(screen.getByText('⌘K')).toBeInTheDocument();
    expect(screen.getByText('+ 发布技能')).toBeInTheDocument();
  });

  it('当前路径的导航项呈现选中态', () => {
    renderWithProviders(<Header />);
    const discover = screen.getByText('发现');
    expect(discover.style.fontWeight).toBe('500');
    const collections = screen.getByText('合辑');
    expect(collections.style.fontWeight).not.toBe('500');
  });
});
