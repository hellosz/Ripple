import type { ReactElement } from 'react';
import { ripple } from '../ripple-api.js';
import { useStore } from '../store.js';
import { INK, MONO, dim, gradBtn } from '../ui.js';

export function Toolbar(): ReactElement {
  const store = useStore();
  const { snapshot, view, loggedIn, updates } = store;

  let title = '本地技能';
  let sub = '跨 Agent 与项目统一管理';
  if (view.kind === 'agent') {
    const agent = snapshot?.agents.find((a) => a.id === view.agentId);
    if (agent) {
      title = agent.name;
      sub = agent.globalPath + (agent.detected ? '' : ' · 未检测到');
    }
  } else if (view.kind === 'project') {
    const project = snapshot?.projects.find((p) => p.path === view.projectPath);
    if (project) {
      title = project.name;
      sub = project.path;
    }
  } else if (view.kind === 'market') {
    title = '技能市场';
    sub = '来自 Ripple 社区';
  } else if (view.kind === 'updates') {
    title = '更新中心';
    sub = `${updates.length} 个技能可更新`;
  } else if (view.kind === 'settings') {
    title = '设置';
    sub =
      store.settingsTab === 'backups'
        ? '自动备份保留最近 20 份'
        : store.settingsTab === 'oplog'
          ? '本地 hub 操作日志（最近 500 条）'
          : '服务 · GitHub / GitLab 仓库 · ZIP · Deep Link';
  }

  const showUpdateAll = loggedIn && updates.length > 0 && view.kind !== 'market';

  const updateAll = (): void => {
    store.run(async () => {
      await ripple.updateAll();
      await store.refresh();
      await store.refreshUpdates();
      store.toast('已全部更新到最新版');
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        borderBottom: '1px solid rgba(63,68,56,.07)',
        background: '#ffffff',
        flex: 'none',
      }}
    >
      <span style={{ fontWeight: 900, fontSize: 16, color: INK, whiteSpace: 'nowrap' }}>{title}</span>
      <span
        style={{
          fontSize: 12,
          color: dim(0.45),
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontFamily: MONO,
        }}
      >
        {sub}
      </span>
      <span style={{ flex: 1 }} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: '1px solid rgba(63,68,56,.12)',
          borderRadius: 9,
          padding: '7px 12px',
          width: 220,
          background: '#faf9f2',
          flex: 'none',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(75,80,64,.45)" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          className="rp-input"
          value={store.query}
          onChange={(e) => store.setQuery(e.target.value)}
          placeholder="搜索技能…"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 12.5,
            color: INK,
            fontFamily: "'Noto Sans SC',sans-serif",
            minWidth: 0,
          }}
        />
      </div>
      {showUpdateAll && (
        <span
          className="rp-btn-grad"
          onClick={updateAll}
          style={{
            ...gradBtn,
            fontSize: 12.5,
            borderRadius: 9,
            padding: '8px 16px',
            flex: 'none',
            boxShadow: '0 2px 8px rgba(147,168,107,.3)',
          }}
        >
          全部更新 ({updates.length})
        </span>
      )}
    </div>
  );
}
