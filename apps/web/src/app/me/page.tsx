'use client';

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import type { ProfileCandidate, SkillListItem, User } from '@ripple/contract';
import { RippleApiError } from '@ripple/api-client';
import { Avatar, Modal, ModalCloseButton, TagChip } from '@ripple/ui';
import { apiClient } from '@/lib/api';
import { displayName, fmtCount } from '@/lib/format';
import { useAuth } from '@/components/providers/auth-context';
import { useToast } from '@/components/providers/toast-context';

type Tab = '我发布的' | '我收藏的';

export default function MePage(): ReactElement {
  const router = useRouter();
  const { user, ready, openAuthModal, updateUser, logout } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('我发布的');
  const [published, setPublished] = useState<SkillListItem[]>([]);
  const [likes, setLikes] = useState<SkillListItem[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    void apiClient()
      .users.myPublished()
      .then(setPublished)
      .catch(() => setPublished([]));
    void apiClient()
      .users.myLikes()
      .then(setLikes)
      .catch(() => setLikes([]));
  }, [user]);

  if (!ready) {
    return <div style={{ textAlign: 'center', padding: '96px 0', color: 'rgba(75,80,64,.4)', fontSize: 13 }}>涟漪加载中…</div>;
  }

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '96px 32px', color: 'rgba(75,80,64,.5)' }}>
        <div style={{ fontSize: 16 }}>登录后查看个人中心</div>
        <button
          type="button"
          className="rp-btn rp-btn-primary"
          onClick={openAuthModal}
          style={{ marginTop: 18, fontSize: 13, borderRadius: 999, padding: '9px 24px' }}
        >
          登录 / 注册
        </button>
      </div>
    );
  }

  const list = tab === '我发布的' ? published : likes;
  const spreadTotal = published.reduce((a, b) => a + b.stats.ripple_count, 0);
  const heatTop = published.length > 0 ? Math.max(...published.map((s) => s.stats.heat)) : 0;
  const emptyHint =
    tab === '我发布的'
      ? '还没有发布技能 — 用 CLI ripple publish 开始分享'
      : '还没有收藏 — 在信息流里点心形即可收藏';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '44px 32px 72px', animation: 'rp-fade-in .25s ease-out' }}>
      <div
        style={{
          border: '1px solid rgba(147,168,107,.3)',
          borderRadius: 20,
          padding: '30px 32px',
          background: 'linear-gradient(135deg,rgba(147,168,107,.12),rgba(147,168,107,.05))',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <Avatar name={displayName(user)} size={76} style={{ border: '2px solid rgba(147,168,107,.5)' }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 900, fontSize: 24, color: 'var(--rp-ink)', whiteSpace: 'nowrap' }}>
              {displayName(user)}
            </span>
            <span style={{ fontSize: 12, color: 'rgba(75,80,64,.4)', fontFamily: 'var(--rp-font-display)', whiteSpace: 'nowrap' }}>
              @{user.email.split('@')[0]}
            </span>
            <TagChip>{user.role === 'admin' ? '管理员' : '创作者'}</TagChip>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--rp-muted)', lineHeight: 1.7 }}>
            {user.description ?? '这个人很安静，还没有留下简介。'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 28, flex: 'none' }}>
          {[
            { label: '发布', value: String(published.length), color: 'var(--rp-ink)' },
            { label: '收藏', value: String(likes.length), color: 'var(--rp-ink)' },
            { label: '累计传播', value: fmtCount(spreadTotal), color: 'var(--rp-ink)' },
            { label: '最高热度', value: String(heatTop), color: 'var(--rp-primary)' },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--rp-font-display)', fontWeight: 700, fontSize: 22, color: s.color }}>
                {s.value}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(75,80,64,.4)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
          <button
            type="button"
            className="rp-btn rp-btn-outline"
            onClick={() => setEditOpen(true)}
            style={{ fontSize: 13, borderRadius: 10, padding: '8px 18px' }}
          >
            编辑资料
          </button>
          <button
            type="button"
            className="rp-btn rp-btn-ghost"
            onClick={() => {
              logout();
              showToast('已退出登录');
              router.push('/');
            }}
            style={{ fontSize: 12.5, borderRadius: 10, padding: '6px 18px' }}
          >
            退出登录
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1px solid rgba(63,68,56,.08)', marginTop: 28 }}>
        {(['我发布的', '我收藏的'] as Tab[]).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            style={{
              fontSize: 14,
              padding: '10px 16px',
              cursor: 'pointer',
              border: 'none',
              background: 'none',
              fontFamily: 'var(--rp-font-sans)',
              fontWeight: tab === name ? 700 : 400,
              color: tab === name ? 'var(--rp-ink)' : 'rgba(75,80,64,.5)',
              borderBottom: tab === name ? '2px solid var(--rp-primary)' : '2px solid transparent',
            }}
          >
            {name}
          </button>
        ))}
      </div>
      {list.map((sk) => (
        <div
          key={sk.id}
          className="rp-row-hover"
          onClick={() => router.push(`/skill/${sk.name}`)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '18px 6px',
            borderBottom: '1px solid rgba(63,68,56,.06)',
            cursor: 'pointer',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--rp-ink)', whiteSpace: 'nowrap' }}>
                {sk.display_name}
              </span>
              {sk.category ? <TagChip>{sk.category}</TagChip> : null}
            </div>
            <p
              style={{
                margin: '5px 0 0',
                fontSize: 13,
                color: 'rgba(75,80,64,.5)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {sk.description}
            </p>
          </div>
          <span style={{ fontSize: 12, color: 'rgba(75,80,64,.45)', whiteSpace: 'nowrap' }}>
            传播 {fmtCount(sk.stats.ripple_count)} · 收藏 {fmtCount(sk.stats.like_count)} · 评论{' '}
            {fmtCount(sk.stats.comment_count)}
          </span>
          <span style={{ fontFamily: 'var(--rp-font-display)', fontWeight: 700, fontSize: 14, color: 'var(--rp-primary)', whiteSpace: 'nowrap' }}>
            {sk.stats.heat}
          </span>
          <span style={{ color: 'rgba(75,80,64,.3)' }}>→</span>
        </div>
      ))}
      {list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'rgba(75,80,64,.5)' }}>
          <div style={{ fontSize: 15 }}>这里还很安静</div>
          <div style={{ fontSize: 13, marginTop: 6, color: 'rgba(75,80,64,.35)' }}>{emptyHint}</div>
        </div>
      ) : null}
      {editOpen ? <EditProfileModal onClose={() => setEditOpen(false)} onSaved={updateUser} /> : null}
    </div>
  );
}

function EditProfileModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (user: User) => void;
}): ReactElement {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [description, setDescription] = useState(user?.description ?? '');
  const [candidates, setCandidates] = useState<ProfileCandidate[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await apiClient().users.generateProfile();
      setCandidates(res.candidates);
    } catch (e) {
      showToast(e instanceof RippleApiError ? e.message : '生成失败，请稍后重试');
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await apiClient().users.updateMe({
        nickname: nickname.trim() || undefined,
        description: description.trim() || undefined,
      });
      onSaved(updated);
      showToast('资料已更新');
      onClose();
    } catch (e) {
      showToast(e instanceof RippleApiError ? e.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} width={520}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 900, fontSize: 20, color: 'var(--rp-ink)' }}>编辑资料</div>
        <ModalCloseButton onClose={onClose} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
        <label style={{ fontSize: 12.5, color: 'rgba(75,80,64,.55)' }}>
          昵称
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="rp-input"
            style={{ width: '100%', marginTop: 6 }}
            placeholder="给自己起个名字"
          />
        </label>
        <label style={{ fontSize: 12.5, color: 'rgba(75,80,64,.55)' }}>
          简介
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rp-input"
            rows={3}
            style={{ width: '100%', marginTop: 6, resize: 'vertical', borderRadius: 12 }}
            placeholder="一句话介绍自己"
          />
        </label>
        <div>
          <button
            type="button"
            className="rp-btn rp-btn-outline"
            disabled={generating}
            onClick={() => void generate()}
            style={{ fontSize: 12.5, borderRadius: 999, padding: '7px 16px' }}
          >
            {generating ? 'AI 生成中…' : '✨ AI 生成昵称 + 简介候选'}
          </button>
        </div>
        {candidates.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {candidates.map((c, i) => (
              <div
                key={i}
                className="rp-row-hover"
                onClick={() => {
                  setNickname(c.nickname);
                  setDescription(c.description);
                }}
                style={{
                  border: '1px solid rgba(147,168,107,.3)',
                  borderRadius: 12,
                  padding: '10px 14px',
                  cursor: 'pointer',
                  background:
                    nickname === c.nickname && description === c.description
                      ? 'rgba(147,168,107,.14)'
                      : undefined,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--rp-ink)' }}>{c.nickname}</div>
                <div style={{ fontSize: 12, color: 'rgba(75,80,64,.55)', marginTop: 3, lineHeight: 1.6 }}>
                  {c.description}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
          <button
            type="button"
            className="rp-btn rp-btn-outline"
            onClick={onClose}
            style={{ fontSize: 13, borderRadius: 10, padding: '8px 18px' }}
          >
            取消
          </button>
          <button
            type="button"
            className="rp-btn rp-btn-primary"
            disabled={saving}
            onClick={() => void save()}
            style={{ fontSize: 13, borderRadius: 10, padding: '8px 22px' }}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
