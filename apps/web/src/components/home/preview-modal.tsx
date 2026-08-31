'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';
import Link from 'next/link';
import type { EngagementState, SkillListItem, SkillStats } from '@ripple/contract';
import { RippleApiError } from '@ripple/api-client';
import { Avatar, Modal, ModalCloseButton, TagChip } from '@ripple/ui';
import { apiClient } from '@/lib/api';
import { copyText, displayName, fmtCount, heatBars, ORIGIN_LABELS, timeAgo } from '@/lib/format';
import { installViaDeepLink } from '@/lib/install';
import { useAuth } from '@/components/providers/auth-context';
import { useToast } from '@/components/providers/toast-context';

export interface PreviewModalProps {
  item: SkillListItem | null;
  onClose: () => void;
  onItemUpdate?: (id: string, stats: SkillStats, engagement: EngagementState) => void;
}

/** 轻量预览弹窗：热度分解条形图 + 快捷操作 */
export function PreviewModal({ item, onClose, onItemUpdate }: PreviewModalProps): ReactElement | null {
  const { showToast } = useToast();
  const { openAuthModal } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!item) return null;
  const liked = item.engagement_state.liked_at !== null;
  const bars = heatBars(item.stats);
  const max = Math.max(1, ...bars.map((b) => b.value));

  const doCopy = async () => {
    await copyText(item.install_command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
    try {
      const res = await apiClient().interactions.copy(item.name);
      onItemUpdate?.(item.id, res.stats, res.engagement_state);
    } catch {
      /* ignore */
    }
  };

  const doFav = async () => {
    try {
      const res = liked
        ? await apiClient().interactions.unlike(item.name)
        : await apiClient().interactions.like(item.name);
      onItemUpdate?.(item.id, res.stats, res.engagement_state);
    } catch (e) {
      if (e instanceof RippleApiError && e.status === 401) openAuthModal();
      else showToast(e instanceof RippleApiError ? e.message : '操作失败，请稍后重试');
    }
  };

  return (
    <Modal open onClose={onClose} width={640}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 900, fontSize: 24, color: 'var(--rp-ink)' }}>{item.display_name}</span>
            {item.category ? <TagChip>{item.category}</TagChip> : null}
            <TagChip tone="soft">{ORIGIN_LABELS[item.origin_type]}</TagChip>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
              fontSize: 12.5,
              color: 'rgba(75,80,64,.5)',
            }}
          >
            <Avatar name={displayName(item.author)} size={22} />
            {displayName(item.author)} 分享 · {timeAgo(item.created_at)}
          </div>
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>
      <p style={{ margin: '18px 0 0', fontSize: 14.5, lineHeight: 1.85, color: 'rgba(75,80,64,.7)' }}>
        {item.description}
      </p>
      {item.recommendation ? (
        <div
          style={{
            marginTop: 16,
            borderLeft: '3px solid rgba(147,168,107,.5)',
            padding: '8px 14px',
            background: 'rgba(147,168,107,.05)',
            borderRadius: '0 10px 10px 0',
            fontSize: 13.5,
            fontStyle: 'italic',
            color: 'rgba(75,80,64,.65)',
            lineHeight: 1.7,
          }}
        >
          “{item.recommendation}” —— {displayName(item.author)}
        </div>
      ) : null}
      <div style={{ marginTop: 24, border: '1px solid rgba(63,68,56,.08)', borderRadius: 14, padding: '18px 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.15em', color: 'var(--rp-primary)' }}>
            热度 {item.stats.heat}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(75,80,64,.35)' }}>
            传播×1 + 收藏×2 + 评论×4 + 查询×0.05
          </span>
        </div>
        {bars.map((b) => (
          <div
            key={b.label}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0', fontSize: 12 }}
          >
            <span style={{ width: 32, color: 'rgba(75,80,64,.5)', whiteSpace: 'nowrap' }}>{b.label}</span>
            <div
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                background: 'rgba(63,68,56,.06)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: 3,
                  background: 'linear-gradient(90deg,#6b7f43,#93a86b)',
                  width: `${Math.min(100, Math.round((100 * b.value) / max))}%`,
                }}
              />
            </div>
            <span
              style={{
                width: 44,
                textAlign: 'right',
                fontFamily: 'var(--rp-font-display)',
                color: 'rgba(75,80,64,.65)',
                whiteSpace: 'nowrap',
              }}
            >
              {fmtCount(b.value)}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20 }}>
        <div
          className="rp-cmd-box"
          onClick={() => void doCopy()}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(63,68,56,.04)',
            border: '1px solid rgba(63,68,56,.09)',
            borderRadius: 8,
            padding: '9px 12px',
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
          onClick={() =>
            installViaDeepLink({
              slug: item.name,
              command: item.install_command,
              onFallback: () => showToast('未检测到桌面客户端 — 安装命令已复制，在终端里运行即可'),
            })
          }
          style={{ fontSize: 13, borderRadius: 10, padding: '10px 24px' }}
        >
          安装
        </button>
        <button
          type="button"
          className="rp-btn rp-btn-outline"
          onClick={() => void doFav()}
          style={{
            fontSize: 13,
            borderRadius: 10,
            padding: '9px 18px',
            color: liked ? 'var(--rp-primary)' : undefined,
          }}
        >
          {liked ? '已收藏' : '收藏'}
        </button>
        <Link
          href={`/skill/${item.name}`}
          onClick={onClose}
          style={{
            fontSize: 13,
            color: 'var(--rp-primary)',
            whiteSpace: 'nowrap',
            padding: '9px 6px',
            textDecoration: 'underline',
          }}
        >
          完整详情 →
        </Link>
      </div>
    </Modal>
  );
}
