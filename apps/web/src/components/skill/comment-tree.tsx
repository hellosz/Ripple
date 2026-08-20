'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';
import type { SkillComment } from '@ripple/contract';
import { Avatar } from '@ripple/ui';
import { displayName, timeAgo } from '@/lib/format';

export interface CommentTreeProps {
  comments: SkillComment[];
  onReply: (parentId: string, content: string) => Promise<boolean>;
  depth?: number;
}

/** 嵌套评论树（递归渲染 + 回复框） */
export function CommentTree({ comments, onReply, depth = 0 }: CommentTreeProps): ReactElement {
  return (
    <div data-testid={depth === 0 ? 'comment-tree' : undefined}>
      {comments.map((c) => (
        <CommentNode key={c.id} comment={c} onReply={onReply} depth={depth} />
      ))}
    </div>
  );
}

function CommentNode({
  comment,
  onReply,
  depth,
}: {
  comment: SkillComment;
  onReply: (parentId: string, content: string) => Promise<boolean>;
  depth: number;
}): ReactElement {
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    const ok = await onReply(comment.id, text);
    setBusy(false);
    if (ok) {
      setDraft('');
      setReplying(false);
    }
  };

  return (
    <div
      data-testid="comment-node"
      style={{
        display: 'flex',
        gap: 12,
        padding: '14px 4px 4px',
        borderBottom: depth === 0 ? '1px solid rgba(63,68,56,.05)' : undefined,
        marginLeft: depth > 0 ? 20 : 0,
      }}
    >
      <Avatar name={displayName(comment.author)} size={30} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--rp-ink)' }}>
            {displayName(comment.author)}
          </span>
          <span style={{ fontSize: 11.5, color: 'rgba(75,80,64,.35)' }}>{timeAgo(comment.created_at)}</span>
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            style={{
              fontSize: 11.5,
              color: 'var(--rp-primary)',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'var(--rp-font-sans)',
            }}
          >
            {replying ? '取消' : '回复'}
          </button>
        </div>
        <p style={{ margin: '5px 0 8px', fontSize: 13.5, lineHeight: 1.75, color: 'rgba(75,80,64,.65)' }}>
          {comment.content}
        </p>
        {replying ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
              placeholder={`回复 ${displayName(comment.author)}…`}
              className="rp-input"
              style={{ flex: 1, borderRadius: 999, padding: '7px 14px', fontSize: 12.5 }}
            />
            <button
              type="button"
              className="rp-btn rp-btn-primary"
              disabled={busy}
              onClick={() => void submit()}
              style={{ fontSize: 12, borderRadius: 999, padding: '6px 16px' }}
            >
              发布
            </button>
          </div>
        ) : null}
        {comment.children.length > 0 ? (
          <CommentTree comments={comment.children} onReply={onReply} depth={depth + 1} />
        ) : null}
      </div>
    </div>
  );
}
