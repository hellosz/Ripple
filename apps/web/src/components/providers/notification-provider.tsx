'use client';

import { useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import type { RippleNotification } from '@ripple/contract';
import { SseNotificationClient } from '@ripple/api-client';
import { Avatar, Modal, ModalCloseButton } from '@ripple/ui';
import { apiClient, getGuestSession, getToken } from '@/lib/api';
import { displayName } from '@/lib/format';
import { useAuth } from './auth-context';
import { useToast } from './toast-context';

const GUEST_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/** SSE 实时通知 + 游客会话维持 + 涟漪揭示弹窗 */
export function NotificationProvider({ children }: { children: ReactNode }): ReactElement {
  const { user, ready } = useAuth();
  const { showToast } = useToast();
  const [reveal, setReveal] = useState<RippleNotification | null>(null);

  // 登录后维持 SSE 长连接
  useEffect(() => {
    if (!user || !getToken()) return;
    const sse = new SseNotificationClient({
      baseUrl: window.location.origin,
      getToken,
    });
    const off = sse.onNotification((n) => {
      if (n.type === 'ripple') {
        showToast(`${displayName(n.sender)} 把「${n.skill_display_name}」传播给了你`, {
          label: '查看',
          onAction: () => {
            setReveal(n);
            void apiClient()
              .ripples.consume(n.delivery_id)
              .catch(() => undefined);
          },
        });
      } else if (n.type === 'skill_update') {
        showToast(`你下载过的「${n.skill_display_name}」发布了新版本 ${n.new_version}`);
      }
    });
    sse.connect();
    return () => {
      off();
      sse.close();
    };
  }, [user, showToast]);

  // 游客：持久化 session UUID + 周期 touch（5 分钟一次）
  useEffect(() => {
    if (!ready || user) return;
    getGuestSession();
    const touch = () => {
      void apiClient()
        .ripples.guestTouch()
        .catch(() => undefined);
    };
    touch();
    const timer = window.setInterval(touch, GUEST_TOUCH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [ready, user]);

  return (
    <>
      {children}
      <Modal open={reveal !== null} onClose={() => setReveal(null)} width={440}>
        {reveal ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.25em', color: 'var(--rp-primary)' }}>
                一圈涟漪抵达了你
              </div>
              <ModalCloseButton onClose={() => setReveal(null)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
              <Avatar name={displayName(reveal.sender)} size={44} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--rp-ink)' }}>
                  {displayName(reveal.sender)}
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(75,80,64,.5)', marginTop: 2 }}>
                  向你传播了技能「{reveal.skill_display_name}」
                </div>
              </div>
            </div>
            {reveal.comment ? (
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
                “{reveal.comment}”
              </div>
            ) : null}
            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <Link
                href={`/skill/${reveal.skill_slug}`}
                onClick={() => setReveal(null)}
                style={{ fontSize: 13, color: 'var(--rp-primary)', textDecoration: 'underline' }}
              >
                查看技能 →
              </Link>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
