import { useState } from 'react';
import type { ReactElement } from 'react';
import { ripple } from '../ripple-api.js';
import { SCENARIO_GROUPS } from './scenario-panel.js';
import { useStore } from '../store.js';
import { INK, MONO, dim, gradBtn } from '../ui.js';

/** 场景标签下拉：聚合已分析技能的四类标签，点选写入搜索过滤 */
function TagFilter(): ReactElement | null {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const scenarios = store.snapshot?.scenarios ?? {};
  const groups = SCENARIO_GROUPS.map((g) => ({
    ...g,
    tags: [...new Set(Object.values(scenarios).flatMap((s) => s.tags[g.key]))].sort(),
  })).filter((g) => g.tags.length > 0);
  if (groups.length === 0) return null;

  const pick = (tag: string): void => {
    store.setQuery(tag);
    setOpen(false);
  };

  return (
    <span style={{ position: 'relative', flex: 'none' }}>
      <span
        className="rp-chip"
        onClick={() => setOpen((o) => !o)}
        title="按 AI 场景标签筛选技能"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          border: '1px solid rgba(63,68,56,.12)',
          borderRadius: 9,
          padding: '7px 12px',
          fontSize: 12,
          color: dim(0.6),
          cursor: 'pointer',
          background: open ? 'rgba(147,168,107,.12)' : '#faf9f2',
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2H2v10l9.3 9.3a2 2 0 0 0 2.8 0l7.2-7.2a2 2 0 0 0 0-2.8z" />
          <circle cx="7.5" cy="7.5" r="1" fill="currentColor" />
        </svg>
        标签
      </span>
      {open && (
        <>
          <span onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 39 }} />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              zIndex: 40,
              width: 320,
              maxHeight: 340,
              overflowY: 'auto',
              background: '#ffffff',
              border: '1px solid rgba(63,68,56,.12)',
              borderRadius: 12,
              boxShadow: '0 12px 32px rgba(63,68,56,.16)',
              padding: '12px 14px',
              animation: 'fade-in .15s ease-out',
            }}
          >
            {groups.map((g) => (
              <div key={g.key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: g.color, marginBottom: 6 }}>{g.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {g.tags.map((t) => (
                    <span
                      key={t}
                      className="rp-chip"
                      onClick={() => pick(t)}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 10px',
                        borderRadius: 999,
                        background: `${g.color}14`,
                        color: g.color,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </span>
  );
}

export function Toolbar(): ReactElement {
  const store = useStore();
  const { snapshot, view, loggedIn, updates, community } = store;
  const communityCount = (community ?? []).filter((c) => c.installed && c.changed).length;

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
  } else if (view.kind === 'community') {
    title = '社区开源';
    sub = 'GitHub / GitLab 技能仓库 · 无需登录';
  } else if (view.kind === 'discover') {
    title = '发现';
    sub = '开源技能生态 · GitHub 排行与精选';
  } else if (view.kind === 'tasks') {
    title = '任务';
    sub = '对本地技能批量运行分析任务';
  } else if (view.kind === 'updates') {
    title = '更新中心';
    sub = `市场 ${loggedIn ? updates.length : '—'} · 社区 ${communityCount} 个可更新`;
  } else if (view.kind === 'settings') {
    title = '设置';
    sub =
      store.settingsTab === 'backups'
        ? '自动备份保留最近 20 份'
        : store.settingsTab === 'oplog'
          ? '本地 hub 操作日志（最近 500 条）'
          : store.settingsTab === 'about'
            ? '版本信息与应用更新'
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
      {(view.kind === 'local' || view.kind === 'agent' || view.kind === 'project') && <TagFilter />}
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
