import { useState } from 'react';
import type { ReactElement } from 'react';
import type { InstallTarget } from '@ripple/hub';
import { AgentIcon } from '../agent-icons.js';
import { ripple } from '../ripple-api.js';
import { useStore } from '../store.js';
import { DANGER, INK, MONO, dim } from '../ui.js';

interface PendingUninstall {
  kind: 'all' | 'one';
  target?: InstallTarget;
  label: string;
}

/** 卸载弹窗：整技能（移除全部落点）或指定 Agent/落点卸载；二次确认并提示自动备份 */
export function UninstallModal({
  skill,
  onClose,
  onDone,
}: {
  skill: string;
  onClose: () => void;
  /** 卸载成功后回调（如关闭上层详情弹窗） */
  onDone?: () => void;
}): ReactElement {
  const store = useStore();
  const { snapshot } = store;
  const [pending, setPending] = useState<PendingUninstall | null>(null);
  const [busy, setBusy] = useState(false);

  const placements = (snapshot?.installs ?? []).filter((i) => i.skill === skill);
  const agentName = (id: string): string => snapshot?.agents.find((a) => a.id === id)?.name ?? id;
  const scopeText = (scope: string): string =>
    scope === 'global' ? '全局' : (scope.split(/[\\/]/).filter(Boolean).pop() ?? scope);

  const run = (): void => {
    if (!pending || busy) return;
    setBusy(true);
    store.run(async () => {
      try {
        await ripple.uninstall(skill, pending.kind === 'all' ? undefined : pending.target);
        await store.refresh();
        store.toast(
          pending.kind === 'all'
            ? `已卸载「${skill}」（全部安装位置，已自动备份）`
            : `已从 ${pending.label} 卸载「${skill}」（已自动备份）`,
        );
        onClose();
        onDone?.();
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <div
      onClick={(e) => {
        // 可能嵌套在详情弹窗 overlay 内：阻断冒泡避免连带关闭上层
        e.stopPropagation();
        onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
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
          width: 430,
          maxHeight: '76vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 16,
          padding: '22px 24px',
          boxShadow: '0 20px 50px rgba(63,68,56,.2)',
          animation: 'slide-up .25s cubic-bezier(.16,1,.3,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 900, fontSize: 15, color: INK }}>卸载技能</span>
          <span style={{ fontFamily: MONO, fontSize: 12.5, color: dim(0.5), whiteSpace: 'nowrap' }}>{skill}</span>
          <span style={{ flex: 1 }} />
          <span
            className="rp-hover-primary"
            onClick={onClose}
            style={{ color: dim(0.4), cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
          >
            ✕
          </span>
        </div>

        {pending === null && (
          <div style={{ marginTop: 14, overflowY: 'auto', minHeight: 0 }}>
            <div
              className="rp-hover-row"
              onClick={() => setPending({ kind: 'all', label: '全部' })}
              style={{
                border: '1px solid rgba(189,133,120,.35)',
                borderRadius: 10,
                padding: '11px 14px',
                cursor: 'pointer',
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: DANGER }}>卸载整个技能</div>
              <div style={{ fontSize: 11.5, color: dim(0.5), marginTop: 2, lineHeight: 1.7 }}>
                移除全部 {placements.length} 处安装位置；最后一处移除时同时清理中心存储中由 Ripple 管理的内容
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: dim(0.4), padding: '0 2px 6px' }}>
              或仅从指定 Agent / 位置卸载
            </div>
            {placements.map((p) => {
              const target: InstallTarget =
                p.scope === 'global' ? { agent: p.agent } : { agent: p.agent, projectDir: p.scope };
              const label = `${agentName(p.agent)}${p.scope === 'global' ? '' : ` · ${scopeText(p.scope)}`}`;
              return (
                <div
                  key={`${p.agent}\n${p.scope}`}
                  className="rp-hover-row"
                  onClick={() => setPending({ kind: 'one', target, label })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    border: '1px solid rgba(63,68,56,.1)',
                    borderRadius: 10,
                    padding: '9px 14px',
                    cursor: 'pointer',
                    marginBottom: 8,
                    fontSize: 12.5,
                  }}
                >
                  <AgentIcon agentId={p.agent} name={agentName(p.agent)} size={16} />
                  <span style={{ fontWeight: 700, color: INK, whiteSpace: 'nowrap' }}>{agentName(p.agent)}</span>
                  <span style={{ fontSize: 11.5, color: dim(0.45), whiteSpace: 'nowrap' }}>
                    {scopeText(p.scope)} · {p.mode === 'shared' ? '通用' : '专属'}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11.5, color: DANGER, fontWeight: 700, whiteSpace: 'nowrap' }}>卸载 ›</span>
                </div>
              );
            })}
            {placements.length === 0 && (
              <div style={{ fontSize: 12, color: dim(0.45), padding: '8px 2px' }}>
                无纳管安装记录（技能仅存在于中心存储）
              </div>
            )}
          </div>
        )}

        {pending !== null && (
          <>
            <div
              style={{
                margin: '14px 0 12px',
                border: '1px solid rgba(189,133,120,.35)',
                background: 'rgba(189,133,120,.07)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 12.5,
                lineHeight: 1.8,
                color: DANGER,
              }}
            >
              {pending.kind === 'all' ? (
                <>
                  ⚠ 将卸载「<b>{skill}</b>」的全部 <b>{placements.length}</b> 处安装位置。
                </>
              ) : (
                <>
                  ⚠ 将从 <b>{pending.label}</b> 卸载「<b>{skill}</b>」，其他安装位置不受影响。
                </>
              )}
            </div>
            <div style={{ fontSize: 12, color: dim(0.55), lineHeight: 1.8, marginBottom: 16 }}>
              卸载前会自动创建备份，可随时在「历史」或 设置 → 备份管理 中回退恢复。
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <span
                onClick={() => setPending(null)}
                style={{
                  border: '1px solid rgba(63,68,56,.14)',
                  color: dim(0.7),
                  fontSize: 12.5,
                  borderRadius: 9,
                  padding: '7px 16px',
                  cursor: 'pointer',
                }}
              >
                返回
              </span>
              <span
                onClick={run}
                style={{
                  background: DANGER,
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 12.5,
                  borderRadius: 9,
                  padding: '7px 18px',
                  cursor: 'pointer',
                  opacity: busy ? 0.6 : undefined,
                }}
              >
                {busy ? '卸载中…' : '确认卸载'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
