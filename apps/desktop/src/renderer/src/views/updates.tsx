import type { ReactElement } from 'react';
import type { UpdateEntry } from '../../../shared/api.js';
import { ripple } from '../ripple-api.js';
import { useStore } from '../store.js';
import { INK, PRIMARY, cardStyle, dim, glyphOf, gradBtn, iconBox } from '../ui.js';

export function UpdatesView(): ReactElement {
  const store = useStore();
  const { snapshot, updates } = store;

  const updateOne = (u: UpdateEntry): void => {
    store.run(async () => {
      const targets = (snapshot?.installs ?? [])
        .filter((i) => i.skill === u.skill)
        .map((i) => (i.scope === 'global' ? { agent: i.agent } : { agent: i.agent, projectDir: i.scope }));
      await ripple.installFromRegistry(u.skill, targets.length ? targets : [{ agent: snapshot?.settings.default_agent ?? 'claude-code' }]);
      await store.refresh();
      await store.refreshUpdates();
      store.toast(`已更新 ${u.skill} 的 ${u.targets} 处安装`);
    });
  };

  return (
    <>
      {updates.map((u) => (
        <div
          key={u.skill}
          style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px', marginBottom: 10 }}
        >
          <span style={iconBox}>{glyphOf(u.skill)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: INK }}>{u.skill}</div>
            <div style={{ fontSize: 11.5, color: dim(0.5), marginTop: 2 }}>
              {snapshot?.skills[u.skill]?.description ?? '来自远程注册表的新版本'}
            </div>
          </div>
          <span
            style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, color: dim(0.45), whiteSpace: 'nowrap' }}
          >
            v{u.current ?? '—'} → <span style={{ color: PRIMARY, fontWeight: 700 }}>v{u.latest}</span>
          </span>
          <span style={{ fontSize: 11.5, color: dim(0.45), whiteSpace: 'nowrap' }}>{u.targets} 处安装</span>
          <span className="rp-btn-grad" onClick={() => updateOne(u)} style={{ ...gradBtn, fontSize: 12, padding: '7px 16px' }}>
            更新
          </span>
        </div>
      ))}
      {updates.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: dim(0.45) }}>
          <div style={{ fontSize: 14 }}>✓ 一切都是最新的</div>
        </div>
      )}
    </>
  );
}
