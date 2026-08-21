import type { CSSProperties, ReactElement } from 'react';
import type { InstallRecord } from '@ripple/hub';
import type { AgentSummary } from '../../../shared/api.js';
import { AgentIcon } from '../agent-icons.js';
import { ripple } from '../ripple-api.js';
import { targetKey, useStore } from '../store.js';
import {
  AMBER,
  GREEN_DEEP,
  INK,
  PRIMARY,
  cardStyle,
  chipStyle,
  dim,
  glyphOf,
  iconBox,
  outlineBtn,
} from '../ui.js';

interface SkillRowData {
  name: string;
  description: string;
  version: string | null;
  installs: InstallRecord[];
  versions: string[];
  conflict: boolean;
  latest: string | null;
}

/** Agent 存在矩阵单元的状态 */
type CellStatus =
  | { kind: 'shared'; enabled: boolean }
  | { kind: 'dedicated'; enabled: boolean }
  | { kind: 'implicit-shared' }
  | { kind: 'absent' };

export function SkillListView(): ReactElement {
  const store = useStore();
  const { snapshot, view, scope, query, loggedIn, updates } = store;
  if (!snapshot) {
    return <div style={{ textAlign: 'center', padding: '80px 0', color: dim(0.45) }}>加载中…</div>;
  }

  const storageShared = snapshot.settings.storage_location === 'shared';
  const updateBySkill = new Map(updates.map((u) => [u.skill, u]));

  // ---- 当前范围内的安装 ----
  let scoped = snapshot.installs;
  if (view.kind === 'agent') scoped = scoped.filter((i) => i.agent === view.agentId);
  if (view.kind === 'project') scoped = scoped.filter((i) => i.scope === view.projectPath);
  if (view.kind === 'local' && scope === 'global') scoped = scoped.filter((i) => i.scope === 'global');
  if (view.kind === 'local' && scope === 'project') scoped = scoped.filter((i) => i.scope !== 'global');

  const q = query.trim();
  const nameSet = new Set(scoped.map((i) => i.skill));
  // 未纳管但位于共享库中的技能（snapshot.skills 有、installs 无）也进入本地技能列表
  if (view.kind === 'local' && scope !== 'project') {
    for (const name of Object.keys(snapshot.skills)) nameSet.add(name);
  }
  const names = [...nameSet].sort();
  const rows: SkillRowData[] = names
    .map((name) => {
      const meta = snapshot.skills[name] ?? { version: null, description: null };
      const all = snapshot.installs.filter((i) => i.skill === name);
      const versions = [...new Set(all.map((i) => i.version))];
      const conflictVersions = snapshot.conflicts[name];
      return {
        name,
        description: meta.description ?? '',
        version: meta.version,
        installs: scoped.filter((i) => i.skill === name),
        versions,
        conflict: (conflictVersions?.length ?? versions.length) > 1,
        latest: updateBySkill.get(name)?.latest ?? null,
      };
    })
    .filter((r) => !q || r.name.includes(q) || r.description.includes(q));

  const conflictNames = rows.filter((r) => r.conflict).map((r) => r.name);

  const resolveConflicts = (): void => {
    store.run(async () => {
      for (const name of conflictNames) await ripple.unifyVersions(name);
      await store.refresh();
      store.toast('已将所有安装统一到最新版');
    });
  };

  const openSyncFor = (row: SkillRowData): void => {
    const selected: Record<string, boolean> = {};
    for (const i of snapshot.installs) {
      if (i.skill === row.name) {
        selected[targetKey(i.agent, i.scope === 'global' ? undefined : i.scope)] = true;
      }
    }
    store.openSync({
      skill: row.name,
      title: row.name,
      mode: 'sync',
      version: row.version,
      selected,
    });
  };

  // ---- 存在矩阵 ----
  const cellStatus = (skill: string, a: AgentSummary): CellStatus => {
    const recs = snapshot.installs.filter((i) => i.skill === skill && i.agent === a.id);
    if (recs.length > 0) {
      const enabled = recs.some((i) => i.enabled);
      if (recs.some((i) => i.mode === 'shared')) return { kind: 'shared', enabled };
      return { kind: 'dedicated', enabled };
    }
    if (a.sharedDirSupport && storageShared && skill in snapshot.skills) {
      return { kind: 'implicit-shared' };
    }
    return { kind: 'absent' };
  };

  const fillAgent = (skill: string, a: AgentSummary): void => {
    store.run(async () => {
      const rec = await ripple.addPlacement(skill, { agent: a.id });
      await store.refresh();
      store.toast(`已补齐 ${skill} 到 ${a.name}（${rec.mode === 'shared' ? '通用' : '专属'}）`);
    });
  };

  const tagStyle = (bg: string, outline: boolean): CSSProperties => ({
    position: 'absolute',
    right: -5,
    bottom: -5,
    fontSize: 8,
    fontWeight: 800,
    lineHeight: 1,
    padding: '2px 3px',
    borderRadius: 5,
    background: outline ? '#ffffff' : bg,
    color: outline ? bg : '#ffffff',
    border: `1px solid ${bg}`,
    fontFamily: "'Noto Sans SC',sans-serif",
  });

  const renderCell = (row: SkillRowData, a: AgentSummary): ReactElement => {
    const st = cellStatus(row.name, a);
    const base: CSSProperties = {
      position: 'relative',
      width: 26,
      height: 26,
      borderRadius: 8,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 'none',
    };
    if (st.kind === 'absent') {
      return (
        <span
          key={a.id}
          className="rp-chip"
          title={`${a.name} · 未安装 · 点击补齐`}
          onClick={() => fillAgent(row.name, a)}
          style={{ ...base, border: '1px dashed rgba(75,80,64,.3)', cursor: 'pointer' }}
        >
          <AgentIcon agentId={a.id} name={a.name} size={15} color="rgba(75,80,64,.35)" />
        </span>
      );
    }
    if (st.kind === 'implicit-shared') {
      return (
        <span
          key={a.id}
          title={`${a.name} · 通用（经共享目录标准自动可用）`}
          style={{ ...base, border: `1.5px solid rgba(127,165,136,.6)` }}
        >
          <AgentIcon agentId={a.id} name={a.name} size={15} />
          <span style={tagStyle(GREEN_DEEP, true)}>通</span>
        </span>
      );
    }
    const shared = st.kind === 'shared';
    const tip =
      `${a.name} · 已安装（${shared ? '通用' : '专属'}）` + (st.enabled ? '' : ' · 已禁用');
    return (
      <span
        key={a.id}
        title={tip}
        style={{
          ...base,
          border: `1px solid ${shared ? 'rgba(127,165,136,.5)' : 'rgba(107,127,67,.4)'}`,
          background: shared ? 'rgba(127,165,136,.12)' : 'rgba(147,168,107,.14)',
          opacity: st.enabled ? 1 : 0.45,
        }}
      >
        <AgentIcon agentId={a.id} name={a.name} size={15} />
        <span style={tagStyle(shared ? GREEN_DEEP : PRIMARY, false)}>{shared ? '通' : '专'}</span>
      </span>
    );
  };

  return (
    <>
      {/* 范围 chips + 计数 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {view.kind === 'local' &&
          (
            [
              { key: 'all', name: '全部' },
              { key: 'global', name: '仅全局' },
              { key: 'project', name: '仅项目' },
            ] as const
          ).map((c) => (
            <span
              key={c.key}
              className="rp-chip"
              onClick={() => store.setScope(c.key)}
              style={chipStyle(scope === c.key)}
            >
              {c.name}
            </span>
          ))}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: dim(0.45), whiteSpace: 'nowrap', flex: 'none' }}>
          {rows.length} 个技能
        </span>
      </div>

      {/* 冲突横幅 */}
      {conflictNames.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            border: '1px solid rgba(169,138,91,.35)',
            background: 'rgba(169,138,91,.06)',
            borderRadius: 11,
            padding: '11px 16px',
            marginBottom: 14,
            fontSize: 12.5,
            color: AMBER,
          }}
        >
          ⚠ 检测到 {conflictNames.length} 个技能多处版本不一致：{conflictNames.join('、')}
          <span style={{ flex: 1 }} />
          <span
            onClick={resolveConflicts}
            style={{ fontWeight: 700, color: AMBER, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}
          >
            统一到最新版
          </span>
        </div>
      )}

      {/* 技能行 */}
      {rows.map((r) => {
        const versionText = r.conflict
          ? r.versions.map((v) => `v${v}`).join(' / ')
          : `v${r.installs[0]?.version ?? r.version ?? '—'}`;
        // 已检测或已有该技能安装记录的 Agent 进入存在矩阵
        const matrixAgents = snapshot.agents.filter(
          (a) => a.detected || snapshot.installs.some((i) => i.agent === a.id && i.skill === r.name),
        );
        return (
          <div key={r.name} style={{ ...cardStyle, marginBottom: 10, animation: 'fade-in .25s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
              <span style={iconBox}>{glyphOf(r.name)}</span>
              <div style={{ minWidth: 0, width: 250, flex: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: INK,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {r.name}
                  </span>
                  {loggedIn && r.latest !== null && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        background: 'rgba(147,168,107,.12)',
                        color: PRIMARY,
                        borderRadius: 999,
                        padding: '2px 8px',
                        whiteSpace: 'nowrap',
                        flex: 'none',
                      }}
                    >
                      可更新 v{r.latest}
                    </span>
                  )}
                  {r.conflict && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        background: 'rgba(169,138,91,.12)',
                        color: AMBER,
                        borderRadius: 999,
                        padding: '2px 8px',
                        whiteSpace: 'nowrap',
                        flex: 'none',
                      }}
                    >
                      版本不一致
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: dim(0.45),
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.description}
                </div>
              </div>

              {/* Agent 存在矩阵 */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {matrixAgents.map((a) => renderCell(r, a))}
              </div>

              <span
                style={{
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontSize: 12,
                  color: dim(0.5),
                  whiteSpace: 'nowrap',
                  flex: 'none',
                }}
              >
                {versionText}
              </span>
              <span
                className="rp-btn-outline"
                onClick={() => openSyncFor(r)}
                style={{ ...outlineBtn, fontSize: 12, padding: '6px 14px', flex: 'none' }}
              >
                同步
              </span>
              <span
                className="rp-btn-ghost"
                onClick={() => store.setHistoryFor(r.name)}
                title="备份与历史记录"
                style={{
                  border: '1px solid rgba(63,68,56,.12)',
                  color: dim(0.6),
                  fontSize: 12,
                  borderRadius: 8,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flex: 'none',
                }}
              >
                历史
              </span>
            </div>
          </div>
        );
      })}

      {rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: dim(0.45) }}>
          <div style={{ fontSize: 14 }}>此范围内暂无技能</div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: 'rgba(75,80,64,.35)' }}>
            到「技能市场」安装，或换个筛选范围
          </div>
        </div>
      )}
    </>
  );
}
