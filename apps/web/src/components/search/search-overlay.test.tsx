import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Header } from '@/components/layout/header';
import { SearchOverlay } from './search-overlay';
import { makeSkillItem, renderWithProviders } from '@/test/helpers';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const listMock = vi.fn();

vi.mock('@/lib/api', () => ({
  apiClient: () => ({
    skills: {
      list: (query: Record<string, unknown>) => listMock(query),
    },
  }),
  getToken: () => null,
  setToken: vi.fn(),
  getGuestSession: () => 'guest-session-test',
  TOKEN_KEY: 'ripple_token',
  GUEST_SESSION_KEY: 'ripple_guest_session',
  AUTH_CHANGED_EVENT: 'ripple-auth-changed',
}));

describe('SearchOverlay', () => {
  it('点击 Header 搜索入口打开浮层，ESC 关闭', async () => {
    listMock.mockResolvedValue({ items: [makeSkillItem()], total: 1, page: 1, page_size: 6 });
    renderWithProviders(
      <>
        <Header />
        <SearchOverlay />
      </>,
    );
    expect(screen.queryByPlaceholderText('搜索技能、作者或场景…')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('搜索'));
    expect(screen.getByPlaceholderText('搜索技能、作者或场景…')).toBeInTheDocument();

    await waitFor(() => {
      expect(listMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('Git 考古学家')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('搜索技能、作者或场景…')).not.toBeInTheDocument();
  });

  it('输入关键词即时调用 skills.list，Enter 应用到信息流', async () => {
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 6 });
    renderWithProviders(
      <>
        <Header />
        <SearchOverlay />
      </>,
    );
    fireEvent.click(screen.getByText('搜索'));
    const input = screen.getByPlaceholderText('搜索技能、作者或场景…');
    fireEvent.change(input, { target: { value: 'git' } });
    await waitFor(() => {
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ search: 'git' }));
    });
    await waitFor(() => {
      expect(screen.getByText('没有匹配的技能，换个关键词试试')).toBeInTheDocument();
    });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/?q=git');
    expect(screen.queryByPlaceholderText('搜索技能、作者或场景…')).not.toBeInTheDocument();
  });
});
