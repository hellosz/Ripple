"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Reply } from "lucide-react";
import { skills as skillsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/user/UserAvatar";
import { formatRelativeTime } from "@/lib/time";
import type { SkillComment } from "@/types";

interface SkillCommentsProps {
  slug: string;
}

interface CommentEditorProps {
  onSubmit: (content: string) => Promise<void>;
  loading: boolean;
  placeholder: string;
  autoFocus?: boolean;
  onCancel?: () => void;
}

function CommentEditor({
  onSubmit,
  loading,
  placeholder,
  autoFocus = false,
  onCancel,
}: CommentEditorProps) {
  const [content, setContent] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    await onSubmit(trimmed);
    setContent("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        className="min-h-[96px] w-full rounded-2xl border border-[#d9c7ef] bg-white/90 px-4 py-3 text-sm text-[#2d2440] shadow-inner outline-none transition focus:border-[#9f7be7] focus:ring-2 focus:ring-[#cbb3f5]"
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="rounded-xl bg-[linear-gradient(90deg,#7d47dd_0%,#9f67f0_100%)] px-4 py-2 text-sm font-medium text-white shadow-[0_14px_28px_rgba(126,79,219,0.28)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Posting..." : "Post comment"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-[#7a6d91] transition hover:text-[#2d2440]"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

interface CommentItemProps {
  comment: SkillComment;
  onReply: (parentId: string, content: string) => Promise<void>;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  submitting: boolean;
  depth?: number;
}

function CommentItem({
  comment,
  onReply,
  replyingTo,
  setReplyingTo,
  submitting,
  depth = 0,
}: CommentItemProps) {
  const displayName =
    comment.author.nickname || comment.author.email.split("@")[0] || "Anonymous";

  return (
    <div className={depth > 0 ? "ml-4 border-l border-[#ded2ef] pl-4" : ""}>
      <div className="rounded-2xl border border-[#e3daf3] bg-[linear-gradient(180deg,#fffefe_0%,#f7f1ff_100%)] p-4 shadow-[0_12px_30px_rgba(56,32,91,0.08)]">
        <div className="flex items-start gap-3">
          <UserAvatar user={comment.author} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-[#201730]">{displayName}</span>
              <span className="text-xs text-[#8a7ea0]">{formatRelativeTime(comment.created_at)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4f4663]">
              {comment.content}
            </p>
            <button
              type="button"
              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#7d47dd] transition hover:text-[#5e30bc]"
            >
              <Reply size={13} />
              Reply
            </button>
          </div>
        </div>
      </div>

      {replyingTo === comment.id && (
        <div className="mt-3 ml-4">
          <CommentEditor
            onSubmit={(content) => onReply(comment.id, content)}
            loading={submitting}
            placeholder={`Reply to ${displayName}...`}
            autoFocus
            onCancel={() => setReplyingTo(null)}
          />
        </div>
      )}

      {comment.children.length > 0 && (
        <div className="mt-4 space-y-4">
          {comment.children.map((child) => (
            <CommentItem
              key={child.id}
              comment={child}
              onReply={onReply}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              submitting={submitting}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SkillComments({ slug }: SkillCommentsProps) {
  const { user, requireAuth } = useAuth();
  const [comments, setComments] = useState<SkillComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    skillsApi
      .comments(slug)
      .then((data) => {
        if (!cancelled) setComments(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const totalComments = useMemo(() => {
    const countNodes = (items: SkillComment[]): number =>
      items.reduce((sum, item) => sum + 1 + countNodes(item.children), 0);
    return countNodes(comments);
  }, [comments]);

  const refreshComments = async () => {
    const data = await skillsApi.comments(slug);
    setComments(data);
  };

  const submitComment = async (content: string, parentId?: string | null) => {
    if (!user) {
      requireAuth(async () => {
        setSubmitting(true);
        try {
          await skillsApi.createComment(slug, { content, parent_id: parentId ?? null });
          await refreshComments();
          setReplyingTo(null);
        } finally {
          setSubmitting(false);
        }
      });
      return;
    }

    setSubmitting(true);
    try {
      await skillsApi.createComment(slug, { content, parent_id: parentId ?? null });
      await refreshComments();
      setReplyingTo(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="border-t border-[#ddd2ee] pt-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#f0e6ff_0%,#e3d2fb_100%)] text-[#7d47dd] shadow-sm">
          <MessageSquare size={18} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#201730]">Comments</h2>
          <p className="text-sm text-[#7d7391]">
            {totalComments > 0 ? `${totalComments} discussion items` : "Start the first discussion"}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-[28px] border border-[#ddd2ee] bg-[linear-gradient(180deg,#fffdfd_0%,#f8f2ff_100%)] p-5 shadow-[0_18px_48px_rgba(76,44,128,0.08)]">
        <CommentEditor
          onSubmit={(content) => submitComment(content)}
          loading={submitting}
          placeholder="Share implementation notes, usage feedback, or ask follow-up questions..."
        />

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="text-sm text-[#7d7391]">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d8caef] bg-white/70 px-4 py-6 text-center text-sm text-[#7d7391]">
              No comments yet. Be the first to discuss this skill.
            </div>
          ) : (
            comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReply={(parentId, content) => submitComment(content, parentId)}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                submitting={submitting}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
