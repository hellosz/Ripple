import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { SkillCard } from './skill-card';
import { makeEngagement, makeSkillItem, makeStats, renderWithProviders } from '@/test/helpers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const copyMock = vi.fn();

vi.mock('@/lib/api', () => ({
  apiClient: () => ({
    interactions: {
      copy: (slug: string) => copyMock(slug),
    },
  }),
  getToken: () => null,
  setToken: vi.fn(),
  getGuestSession: () => 'guest-session-test',
  TOKEN_KEY: 'ripple_token',
  GUEST_SESSION_KEY: 'ripple_guest_session',
  AUTH_CHANGED_EVENT: 'ripple-auth-changed',
}));

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  copyMock.mockReset();
  copyMock.mockResolvedValue({
    command: 'ripple install git-archaeologist',
    stats: makeStats({ copy_count: 13 }),
    engagement_state: makeEngagement({ copied_at: new Date().toISOString(), ripple_available: true }),
  });
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});

describe('SkillCard', () => {
  it('渲染标题、分类、来源、描述、热度与引语', () => {
    const item = makeSkillItem();
    renderWithProviders(<SkillCard item={item} onPreview={vi.fn()} />);
    expect(screen.getByText('Git 考古学家')).toBeInTheDocument();
    expect(screen.getByText('GitHub 工作流')).toBeInTheDocument();
    expect(screen.getByText('原创')).toBeInTheDocument();
    expect(screen.getByText(/深挖仓库历史/)).toBeInTheDocument();
    expect(screen.getByText('96')).toBeInTheDocument();
    expect(screen.getByText(/十分钟定位到三年前的根因/)).toBeInTheDocument();
    expect(screen.getByText('ripple install git-archaeologist')).toBeInTheDocument();
    expect(screen.getByText('安装')).toBeInTheDocument();
    expect(screen.getByText('预览')).toBeInTheDocument();
  });

  it('点击命令区复制安装命令并显示已复制反馈、上报 copy 互动', async () => {
    const item = makeSkillItem();
    const onItemUpdate = vi.fn();
    renderWithProviders(<SkillCard item={item} onPreview={vi.fn()} onItemUpdate={onItemUpdate} />);
    fireEvent.click(screen.getByText('复制'));
    await waitFor(() => {
      expect(screen.getByText('已复制 ✓')).toBeInTheDocument();
    });
    expect(writeText).toHaveBeenCalledWith('ripple install git-archaeologist');
    await waitFor(() => {
      expect(copyMock).toHaveBeenCalledWith('git-archaeologist');
      expect(onItemUpdate).toHaveBeenCalled();
    });
  });

  it('点击预览按钮触发 onPreview', () => {
    const item = makeSkillItem();
    const onPreview = vi.fn();
    renderWithProviders(<SkillCard item={item} onPreview={onPreview} />);
    fireEvent.click(screen.getByText('预览'));
    expect(onPreview).toHaveBeenCalledWith(item);
  });

  it('未满足前置条件时点击传播给出提示而不调接口', async () => {
    const item = makeSkillItem();
    renderWithProviders(<SkillCard item={item} onPreview={vi.fn()} />);
    fireEvent.click(screen.getByTitle('传播'));
    await waitFor(() => {
      expect(screen.getByText(/才能把它传播出去/)).toBeInTheDocument();
    });
  });
});
