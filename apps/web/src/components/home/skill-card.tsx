'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import type { EngagementState, SkillListItem, SkillStats } from '@ripple/contract';
import { RippleApiError } from '@ripple/api-client';
import { Avatar, TagChip } from '@ripple/ui';
import { apiClient } from '@/lib/api';
import { copyText, displayName, fmtCount, HEAT_FORMULA_HINT, ORIGIN_LABELS, timeAgo } from '@/lib/format';
import { installViaDeepLink } from '@/lib/install';
import { CommentIcon, FlameIcon, HeartIcon, SpreadIcon } from '@/components/icons';
import { useAuth } from '@/components/providers/auth-context';
import { useToast } from '@/components/providers/toast-context';

export interface SkillCardProps {
  item: SkillListItem;
  showQuote?: boolean;
  delay?: number;
  onPreview: (item: SkillListItem) => void;
  onCategory?: (category: string) => void;
  onItemUpdate?: (id: string, stats: SkillStats, engagement: EngagementState) => void;
}

/** 信息流技能卡片 */
export function SkillCard({
  item,
  showQuote = true,
  delay = 0,
  onPreview,
  onCategory,
  onItemUpdate,
}: SkillCardProps): ReactElement {
  const router = useRouter();
  const { showToast } = useToast();
  const { openAuthModal } = useAuth();
  const [copied, setCopied] = useState(false);

  const liked = item.engagement_state.liked_at !== null;

  const handleApiError = (e: unknown) => {
    if (e instanceof RippleApiError) {
      if (e.status === 401) openAuthModal();
      else showToast(e.message);
    } else {
      showToast('操作失败，请稍后重试');
    }
  };

  const doCopy = async () => {
    await copyText(item.install_command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
    try {
      const res = await apiClient().interactions.copy(item.name);
      onItemUpdate?.(item.id, res.stats, res.engagement_state);
    } catch {
      /* 游客复制失败不打断 */
    }
  };

  const doInstall = () => {
    installViaDeepLink({
      slug: item.name,
      command: item.install_command,
      onFallback: () => showToast('未检测到桌面客户端 — 安装命令已复制，在终端里运行即可'),
    });
    void apiClient()
      .interactions.copy(item.name)
      .then((res) => onItemUpdate?.(item.id, res.stats, res.engagement_state))
      .catch(() => undefined);
  };

  const doFav = async () => {
    try {
      const res = liked
        ? await apiClient().interactions.unlike(item.name)
        : await apiClient().interactions.like(item.name);
      onItemUpdate?.(item.id, res.stats, res.engagement_state);
      if (!liked) showToast(`已收藏「${item.display_name}」，热度 +`);
    } catch (e) {
      handleApiError(e);
    }
  };

  const doSpread = async () => {
    if (!item.engagement_state.ripple_available) {
      showToast('先复制 / 收藏 / 下载体验过这个技能，才能把它传播出去');
      return;
    }
    try {
      const res = await apiClient().interactions.ripple(item.name);
      onItemUpdate?.(item.id, res.stats, res.engagement_state);
      showToast(`你把「${item.display_name}」传播了出去，涟漪 +1`);
    } catch (e) {
      handleApiError(e);
    }
  };

  return (
    <article
      style={{
        padding: '26px 4px',
        borderBottom: '1px solid rgba(63,68,56,.07)',
        animation: 'rp-slide-up .4s cubic-bezier(.16,1,.3,1) both',
        animationDelay: `${delay}ms`,
      }}
    >
      <div
        className="rp-card rp-card-hover"
        onClick={() => router.push(`/skill/${item.name}`)}
        style={{ padding: '22px 24px', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 900, fontSize: 21, color: 'var(--rp-ink)', whiteSpace: 'nowrap' }}>
                {item.display_name}
              </span>
              {item.category ? (
                <TagChip
                  onClick={
                    onCategory
                      ? () => {
                          onCategory(item.category ?? '');
                        }
                      : undefined
                  }
                >
                  {item.category}
                </TagChip>
              ) : null}
              <TagChip tone="soft">{ORIGIN_LABELS[item.origin_type]}</TagChip>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.75, color: 'rgba(75,80,64,.6)' }}>
              {item.description}
            </p>
          </div>
          <div
            title={HEAT_FORMULA_HINT}
            style={{
              flex: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              border: '1px solid rgba(147,168,107,.3)',
              borderRadius: 12,
              padding: '8px 14px',
              background: 'linear-gradient(180deg,rgba(147,168,107,.12),rgba(147,168,107,.06))',
            }}
          >
            <FlameIcon />
            <span
              style={{
                fontFamily: 'var(--rp-font-display)',
                fontWeight: 700,
                fontSize: 18,
                color: 'var(--rp-primary)',
                lineHeight: 1,
              }}
            >
              {item.stats.heat}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(75,80,64,.4)', whiteSpace: 'nowrap' }}>热度</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <div
            className="rp-cmd-box"
            onClick={(e) => {
              e.stopPropagation();
              void doCopy();
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(63,68,56,.04)',
              border: '1px solid rgba(63,68,56,.07)',
              borderRadius: 8,
              padding: '8px 12px',
              fontFamily: 'var(--rp-font-mono)',
              fontSize: 12,
              color: 'rgba(107,127,67,.9)',
              minWidth: 0,
              cursor: 'pointer',
            }}
          >
            <span style={{ color: 'rgba(75,80,64,.3)' }}>$</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.install_command}
            </span>
            <span
              style={{
                fontSize: 11,
                color: copied ? '#7fa588' : 'rgba(75,80,64,.35)',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--rp-font-sans)',
              }}
            >
              {copied ? '已复制 ✓' : '复制'}
            </span>
          </div>
          <button
            type="button"
            className="rp-btn rp-btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              doInstall();
            }}
            style={{ fontSize: 13, borderRadius: 10, padding: '9px 22px', flex: 'none' }}
          >
            安装
          </button>
          <button
            type="button"
            className="rp-btn rp-btn-outline"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(item);
            }}
            style={{ fontSize: 13, borderRadius: 10, padding: '8px 18px', flex: 'none' }}
          >
            预览
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '0 4px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 12.5, color: 'rgba(75,80,64,.45)' }}>
          <span
            title="传播"
            onClick={() => void doSpread()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', cursor: 'pointer' }}
          >
            <SpreadIcon />
            {fmtCount(item.stats.ripple_count)}
          </span>
          <span
            title="收藏"
            onClick={() => void doFav()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              color: liked ? 'var(--rp-primary)' : undefined,
            }}
          >
            <HeartIcon fill={liked ? '#6b7f43' : 'none'} />
            {fmtCount(item.stats.like_count)}
          </span>
          <span
            title="评论"
            onClick={() => onPreview(item)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', cursor: 'pointer' }}
          >
            <CommentIcon />
            {fmtCount(item.stats.comment_count)}
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'rgba(75,80,64,.4)', whiteSpace: 'nowrap' }}>
          {timeAgo(item.created_at)}
        </span>
        <span style={{ flex: 1 }} />
        {showQuote && item.recommendation ? (
          <span
            style={{
              fontSize: 13.5,
              color: 'rgba(75,80,64,.7)',
              fontStyle: 'italic',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            “{item.recommendation}”
          </span>
        ) : null}
        <Avatar name={displayName(item.author)} size={26} title={displayName(item.author)} />
      </div>
    </article>
  );
}
