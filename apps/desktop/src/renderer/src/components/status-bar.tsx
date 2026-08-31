import type { ReactElement } from 'react';
import { useStore } from '../store.js';
import { dim, fmtClock } from '../ui.js';

export function StatusBar(): ReactElement {
  const { snapshot, lastScan } = useStore();
  const agents = snapshot?.agents.filter((a) => a.detected).length ?? 0;
  const projects = snapshot?.projects.length ?? 0;
  const skills = new Set((snapshot?.installs ?? []).map((i) => i.skill)).size;
  const scanText = lastScan
    ? Date.now() - lastScan.getTime() < 60_000
      ? '刚刚'
      : fmtClock(lastScan)
    : '—';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '8px 20px',
        borderTop: '1px solid rgba(63,68,56,.07)',
        background: '#ffffff',
        fontSize: 11.5,
        color: dim(0.45),
        flex: 'none',
      }}
    >
      <span>
        {agents} 个 Agent · {projects} 个项目 · {skills} 个本地技能
      </span>
      <span style={{ flex: 1 }} />
      <span>上次扫描 {scanText}</span>
    </div>
  );
}
