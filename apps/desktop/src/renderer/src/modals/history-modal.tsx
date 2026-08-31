import type { ReactElement } from 'react';
import type { HistoryEntry } from '@ripple/hub';
import { ripple } from '../ripple-api.js';
import { useStore } from '../store.js';
import { AMBER, GREEN, INK, MONO, PRIMARY, SOFT, dim, fmtTime, joinPath, outlineBtn } from '../ui.js';

const ACTION_LABELS: Record<HistoryEntry['action'], string> = {
  install: '安装',
  update: '更新',
  sync: '同步',
  rollback: '回退',
  restore: '恢复',
  uninstall: '卸载',
};

const dotColor = (action: HistoryEntry['action']): string => {
  if (action === 'rollback' || action === 'restore') return AMBER;
  if (action === 'install') return GREEN;
  return SOFT;
};

export function HistoryModal(): ReactElement | null {
  const store = useStore();
  const { snapshot, historyFor } = store;
  if (!historyFor || !snapshot) return null;

  const skill = historyFor;
  const entries = [...(snapshot.history[skill] ?? [])].reverse();
  const currentVersion = snapshot.skills[skill]?.version ?? null;
  const currentIdx = currentVersion === null ? -1 : entries.findIndex((h) => h.version === currentVersion);
  const close = (): void => store.setHistoryFor(null);

  const rollback = (entry: HistoryEntry): void => {
    const backup = snapshot.backups.find((b) => b.skill === skill && b.version === entry.version);
    if (!backup) {
      store.toast('无对应版本的备份，无法回退');
      return;
    }
    store.run(async () => {
      await ripple.restoreBackup(backup.id);
      await store.refresh();
      if (store.loggedIn) await store.refreshUpdates();
      store.toast(`已从本地备份回退「${skill}」→ v${entry.version}`);
    });
  };

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
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
          width: 560,
          maxHeight: '70%',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 20px 50px rgba(63,68,56,.2)',
          animation: 'slide-up .25s cubic-bezier(.16,1,.3,1)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 24px 14px' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: INK }}>「{skill}」历史记录</div>
            <div style={{ fontSize: 12, color: dim(0.5), marginTop: 3 }}>
              每次同步 / 更新前自动备份，可回退到任意快照
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <span
            className="rp-hover-row"
            onClick={close}
            style={{ padding: 6, borderRadius: 8, cursor: 'pointer', color: dim(0.5), display: 'flex' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px', minHeight: 0 }}>
          {entries.map((h, idx) => {
            const isCurrent = idx === currentIdx;
            const hasBackup = snapshot.backups.some((b) => b.skill === skill && b.version === h.version);
            const canRollback = currentVersion === null || h.version !== currentVersion;
            return (
              <div
                key={`${h.at}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px dashed rgba(63,68,56,.08)',
                  fontSize: 12.5,
                }}
              >
                <span
                  style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: dotColor(h.action) }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, color: INK, whiteSpace: 'nowrap' }}>
                      {ACTION_LABELS[h.action]}
                    </span>
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", color: PRIMARY, whiteSpace: 'nowrap' }}>
                      v{h.version}
                    </span>
                    {isCurrent && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background: 'rgba(127,165,136,.1)',
                          color: GREEN,
                          borderRadius: 999,
                          padding: '2px 8px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        当前
                      </span>
                    )}
                  </div>
                  <div style={{ color: dim(0.5), marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.detail}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: "'Space Grotesk',sans-serif",
                    fontSize: 11.5,
                    color: dim(0.4),
                    whiteSpace: 'nowrap',
                    flex: 'none',
                  }}
                >
                  {fmtTime(h.at)}
                </span>
                {canRollback && (
                  <span
                    className={hasBackup ? 'rp-btn-outline' : undefined}
                    onClick={() => rollback(h)}
                    title={hasBackup ? undefined : '无对应版本的备份'}
                    style={{
                      ...outlineBtn,
                      fontSize: 11.5,
                      padding: '5px 13px',
                      flex: 'none',
                      ...(hasBackup
                        ? {}
                        : { border: '1px solid rgba(63,68,56,.12)', color: 'rgba(75,80,64,.35)', cursor: 'not-allowed' }),
                    }}
                  >
                    回退到此版本
                  </span>
                )}
              </div>
            );
          })}
          {entries.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: dim(0.45), fontSize: 13 }}>暂无历史记录</div>
          )}
        </div>
        <div
          style={{
            padding: '11px 24px',
            borderTop: '1px solid rgba(63,68,56,.06)',
            fontSize: 11.5,
            color: dim(0.45),
            fontFamily: MONO,
          }}
        >
          备份目录 {joinPath(snapshot.settings.backups_dir, skill)}/
        </div>
      </div>
    </div>
  );
}
