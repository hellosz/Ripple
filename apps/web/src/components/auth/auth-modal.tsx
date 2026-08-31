'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';
import { Button, Modal, ModalCloseButton, RippleLogo } from '@ripple/ui';
import { RippleApiError } from '@ripple/api-client';
import { useAuth } from '@/components/providers/auth-context';

type Mode = 'login' | 'register';

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 16px',
  borderRadius: 12,
  border: '1px solid rgba(63,68,56,.15)',
  background: 'rgba(63,68,56,.04)',
  color: 'var(--rp-ink)',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'var(--rp-font-sans)',
} as const;

/** 登录 / 注册弹窗 */
export function AuthModal(): ReactElement {
  const { authModalOpen, closeAuthModal, login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async () => {
    if (busy) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
        setEmail('');
        setPassword('');
      } else {
        const message = await register(email.trim());
        setNotice(message || '注册成功，请查收邮件获取初始密码');
      }
    } catch (e) {
      setError(e instanceof RippleApiError ? e.message : '请求失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={authModalOpen} onClose={closeAuthModal} width={400}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RippleLogo size={28} />
          <span
            style={{
              fontFamily: 'var(--rp-font-display)',
              fontWeight: 700,
              fontSize: 20,
              color: 'var(--rp-ink)',
            }}
          >
            Ripple
          </span>
        </div>
        <ModalCloseButton onClose={closeAuthModal} />
      </div>
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid rgba(63,68,56,.08)',
          margin: '18px 0 20px',
        }}
      >
        {(
          [
            ['login', '登录'],
            ['register', '注册'],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError('');
              setNotice('');
            }}
            style={{
              fontSize: 14,
              padding: '10px 16px',
              cursor: 'pointer',
              border: 'none',
              background: 'none',
              fontFamily: 'var(--rp-font-sans)',
              fontWeight: mode === m ? 700 : 400,
              color: mode === m ? 'var(--rp-ink)' : 'rgba(75,80,64,.5)',
              borderBottom: mode === m ? '2px solid var(--rp-primary)' : '2px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="邮箱"
          style={inputStyle}
        />
        {mode === 'login' ? (
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            style={inputStyle}
          />
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(75,80,64,.5)', lineHeight: 1.7 }}>
            输入邮箱完成注册，初始密码将发送到你的邮箱。
          </p>
        )}
        {error ? (
          <div style={{ fontSize: 12.5, color: '#b45f4a' }}>{error}</div>
        ) : null}
        {notice ? (
          <div style={{ fontSize: 12.5, color: 'var(--rp-primary)' }}>{notice}</div>
        ) : null}
        <Button type="submit" disabled={busy} style={{ marginTop: 4 }}>
          {busy ? '请稍候…' : mode === 'login' ? '登录' : '注册'}
        </Button>
      </form>
    </Modal>
  );
}
