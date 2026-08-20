'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { EngagementState, SkillComment, SkillDetail, SkillStats } from '@ripple/contract';
import { RippleApiError } from '@ripple/api-client';
import { Avatar } from '@ripple/ui';
import { apiClient } from '@/lib/api';
import { copyText, displayName, fmtCount, HEAT_FORMULA_HINT, ORIGIN_LABELS } from '@/lib/format';
import { installViaDeepLink } from '@/lib/install';
import { BackIcon, DownloadIcon, HeartIcon, ShareIcon, SpreadIcon } from '@/components/icons';
import { useAuth } from '@/components/providers/auth-context';
import { useToast } from '@/components/providers/toast-context';
import { CommentTree } from './comment-tree';
import { FileBrowser } from './file-browser';
import { Markdown } from './markdown';

function countComments(list: SkillComment[]): number {
  return list.reduce((acc, c) => acc + 1 + countComments(c.children), 0);
}

const TOC_ITEMS = [
  { key: 'intro', label: '简介' },
  { key: 'files', label: '文件' },
  { key: 'comments', label: '评论' },
] as const;

/** 技能详情页 */
export function DetailView({ slug }: { slug: string }): ReactElement {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, requireAuth } = useAuth();
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [comments, setComments] = useState<SkillComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [zipUrl, setZipUrl] = useState('');
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [activeToc, setActiveToc] = useState(0);
  const viewed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void apiClient()
      .skills.get(slug)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    void apiClient()
      .skills.comments(slug)
      .then((c) => {
        if (!cancelled) setComments(c);
      })
      .catch(() => undefined);
    setZipUrl(apiClient().skills.downloadUrl(slug));
    if (!viewed.current) {
      viewed.current = true;
      void apiClient()
        .interactions.view(slug)
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const updateStats = useCallback((stats: SkillStats, engagement: EngagementState) => {
    setDetail((prev) => (prev ? { ...prev, stats, engagement_state: engagement } : prev));
  }, []);

  const handleApiError = useCallback(
    (e: unknown) => {
      if (e instanceof RippleApiError) {
        if (e.status === 401) requireAuth();
        else showToast(e.message);
      } else {
        showToast('操作失败，请稍后重试');
      }
    },
    [requireAuth, showToast],
  );

  if (notFound) {
    return (
      <div style={{ textAlign: 'center', padding: '96px 32px', color: 'rgba(75,80,64,.5)' }}>
        <div style={{ fontSize: 16 }}>没有找到这个技能</div>
        <button
          type="button"
          className="rp-btn rp-btn-outline"
          onClick={() => router.push('/')}
          style={{ marginTop: 18, fontSize: 13, borderRadius: 10, padding: '8px 18px' }}
        >
          返回发现
        </button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ textAlign: 'center', padding: '96px 32px', color: 'rgba(75,80,64,.4)', fontSize: 13 }}>
        涟漪加载中…
      </div>
    );
  }

  const liked = detail.engagement_state.liked_at !== null;
  const commentCount = countComments(comments);

  const doCopy = async () => {
    await copyText(detail.install_command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
    try {
      const res = await apiClient().interactions.copy(slug);
      updateStats(res.stats, res.engagement_state);
    } catch {
      /* ignore */
    }
  };

  const doFav = async () => {
    try {
      const res = liked
        ? await apiClient().interactions.unlike(slug)
        : await apiClient().interactions.like(slug);
      updateStats(res.stats, res.engagement_state);
      if (!liked) showToast(`已收藏「${detail.display_name}」，热度 +`);
    } catch (e) {
      handleApiError(e);
    }
  };

  const doSpread = async () => {
    if (!detail.engagement_state.ripple_available) {
      showToast('先复制 / 收藏 / 下载体验过这个技能，才能把它传播出去');
      return;
    }
    try {
      const res = await apiClient().interactions.ripple(slug);
      updateStats(res.stats, res.engagement_state);
      showToast(`你把「${detail.display_name}」传播了出去，涟漪 +1`);
    } catch (e) {
      handleApiError(e);
    }
  };

  const postComment = async (content: string, parentId?: string): Promise<boolean> => {
    if (!user) {
      requireAuth();
      return false;
    }
    try {
      await apiClient().skills.addComment(slug, { content, parent_id: parentId });
      const fresh = await apiClient().skills.comments(slug);
      setComments(fresh);
      showToast('评论已发布，热度 +');
      return true;
    } catch (e) {
      handleApiError(e);
      return false;
    }
  };

  const scrollToSec = (key: string, idx: number) => {
    setActiveToc(idx);
    const el = document.querySelector(`[data-sec="${key}"]`);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 84 });
  };

  const currentVersion = detail.versions[0] ?? null;
  const olderVersions = detail.versions.slice(1);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 260px',
        gap: 32,
        padding: '28px 32px 72px',
        maxWidth: 1200,
        margin: '0 auto',
        animation: 'rp-fade-in .25s ease-out',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 }}>
          <button
            type="button"
            className="rp-btn rp-btn-ghost"
            onClick={() => router.push('/')}
            style={{ fontSize: 13.5, padding: '6px 10px', borderRadius: 10 }}
          >
            <BackIcon />
            返回发现
          </button>
          <button
            type="button"
            className="rp-btn rp-btn-ghost"
            onClick={() => {
              void copyText(window.location.href).then(() => showToast('链接已复制，去激起下一圈涟漪'));
            }}
            style={{ fontSize: 13, padding: '7px 12px', borderRadius: 10 }}
          >
            <ShareIcon />
            分享
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, letterSpacing: '.08em', color: 'var(--rp-primary)' }}>
          <span style={{ whiteSpace: 'nowrap' }}>{detail.category ?? '未分类'}</span>
          <span style={{ color: 'rgba(75,80,64,.25)' }}>/</span>
          <span style={{ whiteSpace: 'nowrap' }}>{ORIGIN_LABELS[detail.origin_type]}</span>
          <span style={{ color: 'rgba(75,80,64,.25)' }}>/</span>
          <span style={{ fontFamily: 'var(--rp-font-display)', color: 'rgba(75,80,64,.5)' }}>
            v{detail.version}
          </span>
        </div>
        <h1 style={{ margin: '10px 0 0', fontSize: 42, fontWeight: 900, color: 'var(--rp-ink)', letterSpacing: '-.01em', lineHeight: 1.15 }}>
          {detail.display_name}
        </h1>
        <p style={{ margin: '16px 0 0', fontSize: 16, lineHeight: 1.85, color: 'rgba(75,80,64,.68)', maxWidth: 620 }}>
          {detail.description}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, fontSize: 12.5, color: 'rgba(75,80,64,.5)' }}>
          <Avatar name={displayName(detail.author)} size={24} />
          <span style={{ whiteSpace: 'nowrap' }}>{displayName(detail.author)}</span>
          <span style={{ color: 'rgba(75,80,64,.25)' }}>·</span>
          <span style={{ whiteSpace: 'nowrap' }}>更新于 {detail.updated_at.slice(0, 10)}</span>
        </div>

        {/* 安装条 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 26,
            border: '1px solid rgba(147,168,107,.45)',
            borderRadius: 16,
            padding: '10px 10px 10px 20px',
            background: 'linear-gradient(120deg,rgba(147,168,107,.14),rgba(147,168,107,.06))',
          }}
        >
          <span style={{ color: 'rgba(75,80,64,.35)', fontFamily: 'var(--rp-font-mono)', fontSize: 14, flex: 'none' }}>
            $
          </span>
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--rp-font-mono)',
              fontSize: 14,
              color: 'var(--rp-primary)',
            }}
          >
            {detail.install_command}
          </span>
          <button
            type="button"
            className="rp-btn rp-btn-outline"
            onClick={() => void doCopy()}
            style={{ fontSize: 12.5, borderRadius: 10, padding: '9px 18px', color: copied ? '#7fa588' : undefined }}
          >
            {copied ? '已复制 ✓' : '复制'}
          </button>
          <a
            href={zipUrl || undefined}
            title="下载 ZIP 包"
            className="rp-btn"
            style={{
              fontSize: 12.5,
              color: 'var(--rp-primary)',
              border: '1px solid rgba(147,168,107,.5)',
              borderRadius: 10,
              padding: '9px 16px',
              flex: 'none',
            }}
          >
            <DownloadIcon />
            ZIP
          </a>
          <button
            type="button"
            className="rp-btn rp-btn-primary"
            onClick={() =>
              installViaDeepLink({
                slug,
                command: detail.install_command,
                onFallback: () => showToast('未检测到桌面客户端 — 安装命令已复制，在终端里运行即可'),
              })
            }
            style={{ fontSize: 15, borderRadius: 12, padding: '12px 36px', flex: 'none' }}
          >
            安装
          </button>
        </div>

        {/* 统计条 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            marginTop: 26,
            border: '1px solid rgba(63,68,56,.09)',
            borderRadius: 14,
            overflow: 'hidden',
            background: 'rgba(63,68,56,.02)',
          }}
        >
          {[
            { label: '热度', value: String(detail.stats.heat), color: 'var(--rp-primary)', hint: HEAT_FORMULA_HINT },
            { label: '传播', value: fmtCount(detail.stats.ripple_count), color: 'var(--rp-ink)' },
            { label: '收藏', value: fmtCount(detail.stats.like_count), color: 'var(--rp-ink)' },
            { label: '查询', value: fmtCount(detail.stats.view_count), color: 'var(--rp-ink)' },
          ].map((s, i, arr) => (
            <div
              key={s.label}
              title={s.hint}
              style={{ padding: '14px 26px', borderRight: i < arr.length - 1 ? '1px solid rgba(63,68,56,.07)' : undefined }}
            >
              <div style={{ fontFamily: 'var(--rp-font-display)', fontWeight: 700, fontSize: 20, color: s.color, lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(75,80,64,.4)', marginTop: 5, whiteSpace: 'nowrap' }}>
                {s.label}
              </div>
            </div>
          ))}
          <span style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}>
            <button
              type="button"
              onClick={() => void doSpread()}
              className="rp-btn"
              style={{
                fontSize: 12.5,
                border: '1px solid rgba(147,168,107,.4)',
                color: 'var(--rp-primary)',
                borderRadius: 999,
                padding: '6px 14px',
              }}
            >
              <SpreadIcon size={13} />
              传播
            </button>
            <button
              type="button"
              onClick={() => void doFav()}
              className="rp-btn"
              style={{
                fontSize: 12.5,
                border: '1px solid rgba(63,68,56,.16)',
                borderRadius: 999,
                padding: '6px 14px',
                color: liked ? 'var(--rp-primary)' : 'rgba(75,80,64,.6)',
              }}
            >
              <HeartIcon size={13} fill={liked ? '#6b7f43' : 'none'} />
              收藏
            </button>
          </div>
        </div>

        {/* Markdown 内容 */}
        <div data-sec="intro" style={{ marginTop: 28, scrollMarginTop: 90 }}>
          <SectionTitle>简介</SectionTitle>
          <div
            style={{
              border: '1px solid rgba(63,68,56,.08)',
              borderRadius: 14,
              padding: '20px 24px',
              background: 'rgba(63,68,56,.02)',
            }}
          >
            {detail.content ? (
              <Markdown source={detail.content} />
            ) : (
              <span style={{ fontSize: 13.5, color: 'rgba(75,80,64,.5)' }}>作者还没有填写详细介绍。</span>
            )}
          </div>
        </div>

        {/* 文件树 */}
        <div data-sec="files" style={{ marginTop: 32, scrollMarginTop: 90 }}>
          <SectionTitle>文件</SectionTitle>
          <FileBrowser slug={slug} />
        </div>

        {/* 评论 */}
        <div data-sec="comments" style={{ marginTop: 28, scrollMarginTop: 90 }}>
          <SectionTitle>评论 · {commentCount}</SectionTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Avatar name={user ? displayName(user) : '?'} size={32} />
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && commentDraft.trim()) {
                  void postComment(commentDraft.trim()).then((ok) => {
                    if (ok) setCommentDraft('');
                  });
                }
              }}
              placeholder="说点什么，让涟漪继续…"
              className="rp-input"
              style={{ flex: 1, borderRadius: 999, padding: '10px 16px' }}
            />
            <button
              type="button"
              className="rp-btn rp-btn-primary"
              onClick={() => {
                if (!commentDraft.trim()) return;
                void postComment(commentDraft.trim()).then((ok) => {
                  if (ok) setCommentDraft('');
                });
              }}
              style={{ fontSize: 13, borderRadius: 999, padding: '9px 20px' }}
            >
              发布
            </button>
          </div>
          <CommentTree comments={comments} onReply={(parentId, content) => postComment(content, parentId)} />
          {comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'rgba(75,80,64,.4)' }}>
              还没有评论 — 说点什么，让涟漪继续
            </div>
          ) : null}
        </div>
      </div>

      {/* 右侧 TOC + 版本卡 */}
      <div style={{ position: 'sticky', top: 88, alignSelf: 'start' }}>
        <div style={{ border: '1px solid rgba(147,168,107,.25)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(63,68,56,.08)', background: 'rgba(147,168,107,.08)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.3em', color: 'rgba(75,80,64,.5)' }}>目录</div>
          </div>
          <div style={{ padding: 10 }}>
            {TOC_ITEMS.map((t, i) => (
              <div
                key={t.key}
                className="rp-toc-item"
                onClick={() => scrollToSec(t.key, i)}
                style={{
                  fontSize: 13,
                  padding: '8px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all .15s',
                  color: i === activeToc ? 'var(--rp-ink)' : 'rgba(75,80,64,.5)',
                  background: i === activeToc ? 'rgba(147,168,107,.18)' : undefined,
                  borderLeft: i === activeToc ? '2px solid var(--rp-primary)' : '2px solid transparent',
                }}
              >
                {t.label}
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 16, border: '1px solid rgba(63,68,56,.1)', borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.3em', color: 'rgba(75,80,64,.5)' }}>版本</span>
            {olderVersions.length > 0 ? (
              <button
                type="button"
                onClick={() => setVersionsOpen((v) => !v)}
                style={{
                  fontSize: 11.5,
                  color: 'var(--rp-primary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  border: 'none',
                  background: 'none',
                  fontFamily: 'var(--rp-font-sans)',
                }}
              >
                {versionsOpen ? '收起' : `历史 (${olderVersions.length})`}
              </button>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10 }}>
            <span style={{ fontFamily: 'var(--rp-font-display)', fontWeight: 700, fontSize: 14, color: 'var(--rp-primary)' }}>
              v{detail.version}
            </span>
            <span style={{ fontSize: 11.5, color: 'rgba(75,80,64,.4)' }}>
              {(currentVersion?.created_at ?? detail.updated_at).slice(0, 10)}
            </span>
          </div>
          {currentVersion?.changelog ? (
            <div style={{ fontSize: 12, color: 'rgba(75,80,64,.55)', marginTop: 4, lineHeight: 1.6 }}>
              {currentVersion.changelog}
            </div>
          ) : null}
          {versionsOpen && olderVersions.length > 0 ? (
            <div style={{ marginTop: 10, borderTop: '1px solid rgba(63,68,56,.07)', paddingTop: 6 }}>
              {olderVersions.map((v) => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '5px 0', fontSize: 12 }}>
                  <span style={{ fontFamily: 'var(--rp-font-display)', color: 'rgba(75,80,64,.55)', whiteSpace: 'nowrap' }}>
                    v{v.version}
                  </span>
                  <span style={{ flex: 1, color: 'rgba(75,80,64,.5)' }}>{v.changelog ?? ''}</span>
                  <span style={{ color: 'rgba(75,80,64,.35)', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {v.created_at.slice(5, 10)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }): ReactElement {
  return (
    <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: 'var(--rp-ink)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 4, height: 16, borderRadius: 2, background: 'var(--rp-primary)' }} />
      {children}
    </h2>
  );
}
