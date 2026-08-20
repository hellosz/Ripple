import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { EngagementState, SkillComment, SkillListItem, SkillStats, UserBrief } from '@ripple/contract';
import { AuthProvider } from '@/components/providers/auth-context';
import { SearchProvider } from '@/components/providers/search-context';
import { ToastProvider } from '@/components/providers/toast-context';

export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(
    <ToastProvider>
      <AuthProvider>
        <SearchProvider>{ui}</SearchProvider>
      </AuthProvider>
    </ToastProvider>,
  );
}

export function makeAuthor(overrides: Partial<UserBrief> = {}): UserBrief {
  return {
    id: '5bb8f8d0-0000-4000-8000-000000000001',
    nickname: '林晚',
    avatar_url: null,
    email: 'linwan@example.com',
    ...overrides,
  };
}

export function makeStats(overrides: Partial<SkillStats> = {}): SkillStats {
  return {
    copy_count: 12,
    like_count: 386,
    download_count: 40,
    ripple_count: 2100,
    ripple_reach: 300,
    view_count: 12400,
    comment_count: 23,
    heat: 96,
    copy_size_tier: 'default',
    like_size_tier: 'default',
    download_size_tier: 'default',
    ripple_size_tier: 'default',
    ...overrides,
  };
}

export function makeEngagement(overrides: Partial<EngagementState> = {}): EngagementState {
  return {
    copied_at: null,
    liked_at: null,
    downloaded_at: null,
    rippled_at: null,
    ripple_available: false,
    ...overrides,
  };
}

export function makeSkillItem(overrides: Partial<SkillListItem> = {}): SkillListItem {
  return {
    id: '5bb8f8d0-0000-4000-8000-000000000002',
    name: 'git-archaeologist',
    display_name: 'Git 考古学家',
    description: '深挖仓库历史，自动生成变更叙事与责任图谱。',
    category: 'GitHub 工作流',
    tags: null,
    rating: 'S',
    origin_type: 'original',
    status: 'active',
    publish_channel: 'production',
    version: '1.2.0',
    recommendation: '十分钟定位到三年前的根因。',
    install_command: 'ripple install git-archaeologist',
    download_url: '/api/skills/git-archaeologist/download',
    author: makeAuthor(),
    stats: makeStats(),
    engagement_state: makeEngagement(),
    created_at: new Date(Date.now() - 12 * 60000).toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeComment(
  id: string,
  content: string,
  children: SkillComment[] = [],
  overrides: Partial<SkillComment> = {},
): SkillComment {
  return {
    id,
    skill_id: '5bb8f8d0-0000-4000-8000-000000000002',
    parent_id: null,
    content,
    author: makeAuthor(),
    children,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
