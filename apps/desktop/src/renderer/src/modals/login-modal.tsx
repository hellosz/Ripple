import { useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import sideBg from '../assets/side-bg.avif';
import { ripple } from '../ripple-api.js';
import { errText, useStore } from '../store.js';
import { DANGER, GREEN_DEEP, HERO_BG, INK, MONO, dim, gradBtn, hostOf } from '../ui.js';

const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid rgba(63,68,56,.14)',
  borderRadius: 9,
  padding: '10px 13px',
  fontSize: 13,
  color: INK,
  outline: 'none',
  fontFamily: MONO,
  background: '#faf9f2',
};

const labelStyle: CSSProperties = { fontSize: 11.5, fontWeight: 700, color: dim(0.55), margin: '14px 0 6px' };

export function LoginModal(): ReactElement | null {
  const store = useStore();
  const { auth, loggedIn, loginOpen } = store;
  const [server, setServer] = useState(auth?.server ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  if (!loginOpen) return null;

  const close = (): void => store.setLoginOpen(false);

  const submit = (): void => {
    if (busy) return;
    if (loggedIn) {
      // 已登录：保存服务地址
      store.run(async () => {
        await ripple.setServer(server.trim());
        await store.refreshAuth();
        close();
        store.toast('服务地址已保存');
      });
      return;
    }
    if (!server.trim() || !email.trim() || !password) {
      store.toast('请填写服务地址、邮箱和密码');
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        const state = await ripple.login(server.trim(), email.trim(), password);
        await store.refreshAuth();
        close();
        store.toast(`已登录 ${hostOf(state.server)}，技能市场与更新已启用`);
      } catch (err) {
        store.toast(`登录失败：${errText(err)}`);
      } finally {
        setBusy(false);
      }
    })();
  };

  const logout = (): void => {
    store.run(async () => {
      await ripple.logout();
      await store.refreshAuth();
      close();
      store.toast('已退出登录，进入本地模式');
    });
  };

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 55,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(63,68,56,.35)',
        backdropFilter: 'blur(6px)',
        animation: 'fade-in .2s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          background: '#ffffff',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(63,68,56,.2)',
          animation: 'slide-up .25s cubic-bezier(.16,1,.3,1)',
        }}
      >
        <div style={{ position: 'relative', height: 86 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              // 与侧边栏连接卡同款头图；加载异常时露出同色系渐变兜底
              backgroundImage: `url(${sideBg}), ${HERO_BG}`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg,rgba(38,46,38,.25),rgba(38,46,38,.55))',
            }}
          />
          <div style={{ position: 'absolute', left: 22, bottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="14" r="2.4" fill="#faf9f2" />
              <path d="M16 22 A8 8 0 0 1 8 14" stroke="#e3e8d2" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".9" />
              <path d="M16 22 A8 8 0 0 0 24 14" stroke="#e3e8d2" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".9" />
            </svg>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15, color: '#faf9f2' }}>
              Ripple
            </span>
          </div>
        </div>
        <div style={{ padding: '20px 26px 24px' }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: INK }}>远程服务</div>
          <p style={{ margin: '6px 0 18px', fontSize: 12.5, lineHeight: 1.7, color: dim(0.55) }}>
            不登录也可使用本地技能管理；登录后可访问技能市场、检查更新与同步收藏。
          </p>
          <div style={{ ...labelStyle, marginTop: 0 }}>服务地址</div>
          <input
            className="rp-input"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder="https://ripple.example.com"
            style={fieldStyle}
          />
          {!loggedIn && (
            <>
              <div style={labelStyle}>邮箱</div>
              <input
                className="rp-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={fieldStyle}
              />
              <div style={labelStyle}>密码</div>
              <input
                className="rp-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
                placeholder="••••••••"
                style={fieldStyle}
              />
            </>
          )}
          {loggedIn && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 14,
                border: '1px solid rgba(127,165,136,.25)',
                background: 'rgba(127,165,136,.05)',
                borderRadius: 10,
                padding: '9px 13px',
                fontSize: 12,
                color: GREEN_DEEP,
              }}
            >
              ✓ 已登录 · {auth?.user?.nickname ?? auth?.user?.email ?? ''}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            {loggedIn && (
              <span
                onClick={logout}
                style={{
                  border: '1px solid rgba(189,133,120,.3)',
                  color: DANGER,
                  fontSize: 13,
                  borderRadius: 9,
                  padding: '8px 18px',
                  cursor: 'pointer',
                }}
              >
                退出登录
              </span>
            )}
            <span
              onClick={close}
              style={{
                border: '1px solid rgba(63,68,56,.14)',
                color: dim(0.7),
                fontSize: 13,
                borderRadius: 9,
                padding: '8px 18px',
                cursor: 'pointer',
              }}
            >
              取消
            </span>
            <span
              className="rp-btn-grad"
              onClick={submit}
              style={{ ...gradBtn, fontSize: 13, borderRadius: 9, padding: '8px 22px', opacity: busy ? 0.6 : undefined }}
            >
              {busy ? '登录中…' : loggedIn ? '保存' : '登录'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
