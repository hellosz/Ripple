import type { CSSProperties, ReactElement } from 'react';
import type { InstallTarget } from '@ripple/hub';
import { ripple } from '../ripple-api.js';
import { parseTargetKey, targetKey, useStore } from '../store.js';
import { GREEN_DEEP, INK, PRIMARY, dim, gradBtn } from '../ui.js';

const targetChip = (on: boolean): CSSProperties => ({
  fontSize: 12,
  padding: '6px 13px',
  borderRadius: 999,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  border: `1px solid ${on ? 'rgba(107,127,67,.5)' : 'rgba(63,68,56,.12)'}`,
  background: on ? 'rgba(147,168,107,.1)' : undefined,
  color: on ? PRIMARY : dim(0.55),
  fontWeight: on ? 700 : undefined,
});

export function SyncModal(): ReactElement | null {
  const store = useStore();
  const { snapshot, sync } = store;
  if (!sync || !snapshot) return null;

  const agentName = (id: string): string => snapshot.agents.find((a) => a.id === id)?.name ?? id;
  const defaultAgent = snapshot.settings.default_agent;

  const agentChips = snapshot.agents
    .filter((a) => a.detected)
    .map((a) => ({ key: targetKey(a.id), name: a.name }));

  const projectChips = snapshot.projects.flatMap((p) => {
    const existing = snapshot.installs.filter((i) => i.skill === sync.skill && i.scope === p.path);
    const agentIds = existing.length ? [...new Set(existing.map((i) => i.agent))] : [defaultAgent];
    return agentIds.map((agent) => ({
      key: targetKey(agent, p.path),
      name: `${p.name}（${agentName(agent)}）`,
    }));
  });

  const count = Object.values(sync.selected).filter(Boolean).length;

  const apply = (): void => {
    if (count === 0) {
      store.toast('请至少勾选一个目标');
      return;
    }
    const targets: InstallTarget[] = Object.entries(sync.selected)
      .filter(([, on]) => on)
      .map(([key]) => parseTargetKey(key));
    store.run(async () => {
      if (sync.mode === 'registry') await ripple.installFromRegistry(sync.skill, targets);
      else await ripple.sync(sync.skill, targets);
      store.closeSync();
      await store.refresh();
      if (store.loggedIn) await store.refreshUpdates();
      store.toast(`已备份并同步「${sync.title}」到 ${count} 个目标`);
    });
  };

  const renderChip = (chip: { key: string; name: string }): ReactElement => {
    const on = !!sync.selected[chip.key];
    return (
      <span key={chip.key} className="rp-chip" onClick={() => store.toggleSyncTarget(chip.key)} style={targetChip(on)}>
        {on ? '✓' : '＋'} {chip.name}
      </span>
    );
  };

  return (
    <div
      onClick={store.closeSync}
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
          width: 460,
          background: '#ffffff',
          borderRadius: 16,
          padding: '24px 26px',
          boxShadow: '0 20px 50px rgba(63,68,56,.2)',
          animation: 'slide-up .25s cubic-bezier(.16,1,.3,1)',
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16, color: INK }}>同步「{sync.title}」</div>
        <p style={{ margin: '6px 0 16px', fontSize: 12.5, color: dim(0.55) }}>
          选择要安装 / 同步到的目标，已勾选项将统一为 {sync.version ? `v${sync.version}` : '最新版'}。
        </p>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.18em', color: dim(0.4), marginBottom: 8 }}>
          AGENT · 全局
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>{agentChips.map(renderChip)}</div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.18em', color: dim(0.4), marginBottom: 8 }}>
          项目 · 本地目录
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {projectChips.length ? projectChips.map(renderChip) : (
            <span style={{ fontSize: 12, color: dim(0.4) }}>暂无项目目录，可在侧边栏「＋」添加</span>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid rgba(127,165,136,.25)',
            background: 'rgba(127,165,136,.05)',
            borderRadius: 10,
            padding: '9px 13px',
            marginBottom: 16,
            fontSize: 12,
            color: GREEN_DEEP,
          }}
        >
          <span style={{ flex: 'none' }}>✓</span>应用前自动创建本地备份，可随时在「历史」中回退到任意版本
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <span
            onClick={store.closeSync}
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
          <span className="rp-btn-grad" onClick={apply} style={{ ...gradBtn, fontSize: 13, borderRadius: 9, padding: '8px 22px' }}>
            应用 ({count})
          </span>
        </div>
      </div>
    </div>
  );
}
