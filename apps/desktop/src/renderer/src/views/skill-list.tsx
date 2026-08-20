import type { CSSProperties, ReactElement } from 'react';
import type { InstallRecord } from '@ripple/hub';
import { ripple } from '../ripple-api.js';
import { targetKey, useStore } from '../store.js';
import {
  AMBER,
  GREEN,
  INK,
  MONO,
  PRIMARY,
  cardStyle,
  chipStyle,
  dim,
  glyphOf,
  iconBox,
  joinPath,
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

export function SkillListView(): ReactElement {
  const store = useStore();
  const { snapshot, view, scope, query, loggedIn, updates, expanded } = store;
  if (!snapshot) {
    return <div style={{ textAlign: 'center', padding: '80px 0', color: dim(0.45) }}>加载中…</div>;
  }

  const agentById = new Map(snapshot.agents.map((a) => [a.id, a]));
  const projectByPath = new Map(snapshot.projects.map((p) => [p.path, p]));
  const updateBySkill = new Map(updates.map((u) => [u.skill, u]));
  const projectName = (path: string): string =>
    projectByPath.get(path)?.name ?? path.split(/[\\/]/).filter(Boolean).pop() ?? path;
  const agentName = (id: string): string => agentById.get(id)?.name ?? id;

  // ---- 当前范围内的安装 ----
  let scoped = snapshot.installs;
  if (view.kind === 'agent') scoped = scoped.filter((i) => i.agent === view.agentId);
  if (view.kind === 'project') scoped = scoped.filter((i) => i.scope === view.projectPath);
  if (view.kind === 'local' && scope === 'global') scoped = scoped.filter((i) => i.scope === 'global');
  if (view.kind === 'local' && scope === 'project') scoped = scoped.filter((i) => i.scope !== 'global');

  const q = query.trim();
  const names = [...new Set(scoped.map((i) => i.skill))].sort();
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

  const toggleEnabled = (row: SkillRowData, i: InstallRecord): void => {
    store.run(async () => {
      const target = i.scope === 'global' ? { agent: i.agent } : { agent: i.agent, projectDir: i.scope };
      await ripple.setEnabled(row.name, target, !i.enabled);
      await store.refresh();
      store.toast(`${i.enabled ? '已禁用' : '已启用'}：${row.name} @ ${agentName(i.agent)}`);
    });
  };

  const uninstallOne = (row: SkillRowData, i: InstallRecord): void => {
    store.run(async () => {
      const target = i.scope === 'global' ? { agent: i.agent } : { agent: i.agent, projectDir: i.scope };
      await ripple.uninstall(row.name, target);
      await store.refresh();
      store.toast(`已卸载：${row.name} @ ${agentName(i.agent)}`);
    });
  };

  const updateOne = (row: SkillRowData, i: InstallRecord): void => {
    const latest = row.latest;
    if (!latest) return;
    store.run(async () => {
      const target = i.scope === 'global' ? { agent: i.agent } : { agent: i.agent, projectDir: i.scope };
      await ripple.installFromRegistry(row.name, [target]);
      await store.refresh();
      await store.refreshUpdates();
      store.toast(`已更新 ${row.name} → v${latest}`);
    });
  };

  const toggleOnStyle: CSSProperties = {
    width: 34,
    height: 19,
    borderRadius: 999,
    background: '#93a86b',
    position: 'relative',
    cursor: 'pointer',
    flex: 'none',
    transition: 'background .2s',
  };
  const toggleOffStyle: CSSProperties = { ...toggleOnStyle, background: 'rgba(75,80,64,.2)' };

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
        const isOpen = !!expanded[r.name];
        const versionText = r.conflict
          ? r.versions.map((v) => `v${v}`).join(' / ')
          : `v${r.installs[0]?.version ?? r.version ?? '—'}`;
        return (
          <div key={r.name} style={{ ...cardStyle, marginBottom: 10, animation: 'fade-in .25s ease-out' }}>
            <div
              onClick={() => store.toggleExpanded(r.name)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }}
            >
              <span style={iconBox}>{glyphOf(r.name)}</span>
              <div style={{ minWidth: 0, width: 250, flex: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: INK, whiteSpace: 'nowrap' }}>{r.name}</span>
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

              {/* 安装矩阵 chips */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {r.installs.map((i) => {
                  const isGlobal = i.scope === 'global';
                  const label = (isGlobal ? '' : `${projectName(i.scope)} · `) + agentName(i.agent);
                  const tip = `${agentName(i.agent)} · ${isGlobal ? '全局' : projectName(i.scope)} · v${i.version}${
                    i.enabled ? '' : ' · 已禁用'
                  }`;
                  return (
                    <span
                      key={targetKey(i.agent, isGlobal ? undefined : i.scope)}
                      title={tip}
                      style={{
                        fontSize: 10.5,
                        padding: '3px 9px',
                        borderRadius: 999,
                        whiteSpace: 'nowrap',
                        border: `1px solid ${i.enabled ? 'rgba(107,127,67,.3)' : 'rgba(75,80,64,.15)'}`,
                        background: i.enabled ? 'rgba(147,168,107,.07)' : 'rgba(75,80,64,.04)',
                        color: i.enabled ? PRIMARY : dim(0.45),
                        textDecoration: i.enabled ? undefined : 'line-through',
                      }}
                    >
                      {label}
                    </span>
                  );
                })}
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
                className="rp-btn-ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  store.setHistoryFor(r.name);
                }}
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
              <span
                className="rp-btn-outline"
                onClick={(e) => {
                  e.stopPropagation();
                  openSyncFor(r);
                }}
                style={{ ...outlineBtn, fontSize: 12, padding: '6px 14px', flex: 'none' }}
              >
                同步…
              </span>
              <span
                style={{
                  color: 'rgba(75,80,64,.35)',
                  flex: 'none',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform .2s',
                }}
              >
                ▾
              </span>
            </div>

            {/* 展开：逐处管理 */}
            {isOpen && (
              <div style={{ borderTop: '1px solid rgba(63,68,56,.06)', padding: '6px 18px 12px', animation: 'fade-in .2s ease-out' }}>
                {r.installs.map((i) => {
                  const isGlobal = i.scope === 'global';
                  const agent = agentById.get(i.agent);
                  const path = isGlobal
                    ? joinPath(agent?.globalPath ?? `~/${i.agent}`, r.name)
                    : joinPath(i.scope, agent?.projectRelPath ?? '.claude/skills', r.name);
                  const outdated =
                    (r.latest !== null && i.version !== r.latest) ||
                    (r.conflict && r.version !== null && i.version !== r.version);
                  const canUpdate = loggedIn && r.latest !== null && i.version !== r.latest;
                  return (
                    <div
                      key={targetKey(i.agent, isGlobal ? undefined : i.scope)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '9px 0',
                        borderBottom: '1px dashed rgba(63,68,56,.06)',
                        fontSize: 12.5,
                      }}
                    >
                      <span
                        style={{
                          width: 210,
                          flex: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          color: INK,
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 6,
                            flex: 'none',
                            background: isGlobal ? 'rgba(147,168,107,.1)' : 'rgba(127,165,136,.1)',
                            color: isGlobal ? PRIMARY : GREEN,
                          }}
                        >
                          {isGlobal ? '全局' : '项目'}
                        </span>
                        {agentName(i.agent) + (isGlobal ? '' : ` · ${projectName(i.scope)}`)}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          fontFamily: MONO,
                          fontSize: 11.5,
                          color: dim(0.45),
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {path}
                      </span>
                      <span
                        style={{
                          fontFamily: "'Space Grotesk',sans-serif",
                          fontSize: 12,
                          color: outdated ? AMBER : dim(0.55),
                          whiteSpace: 'nowrap',
                          flex: 'none',
                        }}
                      >
                        v{i.version}
                      </span>
                      {canUpdate && (
                        <span
                          className="rp-underline"
                          onClick={() => updateOne(r, i)}
                          style={{ fontSize: 11.5, fontWeight: 700, color: PRIMARY, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none' }}
                        >
                          更新
                        </span>
                      )}
                      <span onClick={() => toggleEnabled(r, i)} style={i.enabled ? toggleOnStyle : toggleOffStyle}>
                        <span
                          style={{
                            position: 'absolute',
                            top: 2,
                            width: 15,
                            height: 15,
                            borderRadius: '50%',
                            background: '#ffffff',
                            boxShadow: '0 1px 3px rgba(63,68,56,.25)',
                            transition: 'left .2s',
                            left: i.enabled ? 17 : 2,
                          }}
                        />
                      </span>
                      <span
                        className="rp-hover-danger"
                        onClick={() => uninstallOne(r, i)}
                        title="卸载"
                        style={{ color: 'rgba(75,80,64,.35)', cursor: 'pointer', flex: 'none', padding: '2px 4px', borderRadius: 5 }}
                      >
                        ✕
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
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
