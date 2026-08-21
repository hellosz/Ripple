import { useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { CommunitySkill, InstallRecord } from '@ripple/hub';
import type { AgentSummary } from '../../../shared/api.js';
import { AgentIcon } from '../agent-icons.js';
import { ripple } from '../ripple-api.js';
import { targetKey, useStore } from '../store.js';
import {
  AMBER,
  DANGER,
  GREEN_DEEP,
  INK,
  MONO,
  PRIMARY,
  REPO_BLUE,
  cardStyle,
  chipStyle,
  dim,
  gradBtn,
  originLabel,
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
  /** 社区来源指纹变化条目（有更新，蓝色徽标） */
  communityChanged: CommunitySkill | null;
  /** 来源徽标（origin 映射） */
  origin: string;
}

/** Agent 存在矩阵单元的状态 */
type CellStatus =
  | { kind: 'shared'; enabled: boolean }
  | { kind: 'dedicated'; enabled: boolean }
  | { kind: 'implicit-shared' }
  | { kind: 'absent' };

/** 列表头 Agent 批量操作会话：menu=选动作，apply/remove=二次确认 */
interface AgentActionState {
  agent: AgentSummary;
  step: 'menu' | 'apply' | 'remove';
}

const badgeStyle = (color: string, bg: string): CSSProperties => ({
  fontSize: 10,
  fontWeight: 700,
  background: bg,
  color,
  borderRadius: 999,
  padding: '2px 8px',
  whiteSpace: 'nowrap',
  flex: 'none',
});

export function SkillListView(): ReactElement {
  const store = useStore();
  const { snapshot, view, scope, query, loggedIn, updates, community } = store;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [agentAction, setAgentAction] = useState<AgentActionState | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  if (!snapshot) {
    return <div style={{ textAlign: 'center', padding: '80px 0', color: dim(0.45) }}>加载中…</div>;
  }

  const storageShared = snapshot.settings.storage_location === 'shared';
  const updateBySkill = new Map(updates.map((u) => [u.skill, u]));
  const communityChangedBySkill = new Map(
    (community ?? []).filter((c) => c.changed && c.installed).map((c) => [c.name, c]),
  );

  // ---- 当前范围内的安装 ----
  let scoped = snapshot.installs;
  if (view.kind === 'agent') scoped = scoped.filter((i) => i.agent === view.agentId);
  if (view.kind === 'project') scoped = scoped.filter((i) => i.scope === view.projectPath);
  if (view.kind === 'local' && scope === 'global') scoped = scoped.filter((i) => i.scope === 'global');
  if (view.kind === 'local' && scope === 'project') scoped = scoped.filter((i) => i.scope !== 'global');

  const q = query.trim();
  const buildRow = (name: string, installs: InstallRecord[]): SkillRowData => {
    const meta = snapshot.skills[name] ?? { version: null, description: null };
    const all = snapshot.installs.filter((i) => i.skill === name);
    const versions = [...new Set(all.map((i) => i.version))];
    const conflictVersions = snapshot.conflicts[name];
    return {
      name,
      description: meta.description ?? '',
      version: meta.version,
      installs,
      versions,
      conflict: (conflictVersions?.length ?? versions.length) > 1,
      latest: updateBySkill.get(name)?.latest ?? null,
      communityChanged: communityChangedBySkill.get(name) ?? null,
      origin: originLabel(all[0]?.origin),
    };
  };
  const matchQuery = (r: SkillRowData): boolean =>
    !q || r.name.includes(q) || r.description.includes(q);

  const nameSet = new Set(scoped.map((i) => i.skill));
  // 未纳管但位于共享库中的技能（snapshot.skills 有、installs 无）也进入本地技能列表
  if (view.kind === 'local' && scope !== 'project') {
    for (const name of Object.keys(snapshot.skills)) nameSet.add(name);
  }
  const names = [...nameSet].sort();
  const rows: SkillRowData[] = names
    .map((name) => buildRow(name, scoped.filter((i) => i.skill === name)))
    .filter(matchQuery);

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
          onClick={(e) => {
            e.stopPropagation();
            fillAgent(row.name, a);
          }}
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

  // ---- 技能行 v3 ----
  const renderRow = (r: SkillRowData): ReactElement => {
    const versionText = r.conflict
      ? r.versions.map((v) => `v${v}`).join(' / ')
      : `v${r.installs[0]?.version ?? r.version ?? '—'}`;
    // 已检测或已有该技能安装记录的 Agent 进入存在矩阵
    const matrixAgents = snapshot.agents.filter(
      (a) => a.detected || snapshot.installs.some((i) => i.agent === a.id && i.skill === r.name),
    );
    return (
      <div
        key={r.name}
        className="rp-row-card"
        onClick={() => store.setSkillDetail(r.name)}
        style={{ ...cardStyle, marginBottom: 12, animation: 'fade-in .25s ease-out', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px' }}>
          <div style={{ minWidth: 0, width: 270, flex: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 14.5,
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
                  title={`技能市场有新版 v${r.latest}`}
                  style={badgeStyle(PRIMARY, 'rgba(147,168,107,.14)')}
                >
                  有更新
                </span>
              )}
              {r.communityChanged !== null && (
                <span
                  title={`来源仓库 ${r.communityChanged.sourceId} 内容有变化`}
                  style={badgeStyle(REPO_BLUE, 'rgba(75,127,176,.12)')}
                >
                  有更新
                </span>
              )}
              {r.conflict && (
                <span style={badgeStyle(AMBER, 'rgba(169,138,91,.12)')}>版本不一致</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: 'rgba(75,80,64,.07)',
                  color: dim(0.5),
                  whiteSpace: 'nowrap',
                  flex: 'none',
                }}
              >
                {r.origin}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  color: dim(0.45),
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
              >
                {r.description || '暂无简介'}
              </span>
            </div>
          </div>

          {/* Agent 存在矩阵 */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {matrixAgents.map((a) => renderCell(r, a))}
          </div>

          {/* 操作 + 版本小字 */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flex: 'none' }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
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
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                color: dim(0.45),
                whiteSpace: 'nowrap',
                paddingRight: 2,
              }}
            >
              {versionText}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // ---- 列表头 Agent 批量操作 ----
  const headerAgents = snapshot.agents.filter((a) => a.detected);

  const runAgentAction = (): void => {
    if (!agentAction || actionBusy) return;
    const { agent, step } = agentAction;
    setActionBusy(true);
    store.run(async () => {
      try {
        if (step === 'apply') {
          const { count } = await ripple.applyAllToAgent(agent.id, rows.map((r) => r.name));
          store.toast(`已补齐 ${count} 个技能到 ${agent.name}`);
        } else {
          const { count } = await ripple.removeAllFromAgent(agent.id);
          store.toast(`已从 ${agent.name} 取消 ${count} 个复制`);
        }
        setAgentAction(null);
        await store.refresh();
      } finally {
        setActionBusy(false);
      }
    });
  };

  const renderAgentActionModal = (): ReactElement | null => {
    if (!agentAction) return null;
    const { agent, step } = agentAction;
    const removeCount = snapshot.installs.filter((i) => i.agent === agent.id && i.scope === 'global').length;
    const close = (): void => setAgentAction(null);
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
            width: 400,
            background: '#ffffff',
            borderRadius: 16,
            padding: '22px 24px',
            boxShadow: '0 20px 50px rgba(63,68,56,.2)',
            animation: 'slide-up .25s cubic-bezier(.16,1,.3,1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AgentIcon agentId={agent.id} name={agent.name} size={22} />
            <span style={{ fontWeight: 900, fontSize: 15, color: INK }}>{agent.name} 批量操作</span>
            <span style={{ flex: 1 }} />
            <span
              className="rp-hover-primary"
              onClick={close}
              style={{ color: dim(0.4), cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
            >
              ✕
            </span>
          </div>

          {step === 'menu' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
              <div
                className="rp-hover-row"
                onClick={() => setAgentAction({ agent, step: 'apply' })}
                style={{
                  border: '1px solid rgba(107,127,67,.3)',
                  borderRadius: 10,
                  padding: '11px 14px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>全部复制到 {agent.name}</div>
                <div style={{ fontSize: 11.5, color: dim(0.5), marginTop: 2 }}>
                  把当前范围的 {rows.length} 个技能补齐到该 Agent（已有的跳过）
                </div>
              </div>
              <div
                className="rp-hover-row"
                onClick={() => setAgentAction({ agent, step: 'remove' })}
                style={{
                  border: '1px solid rgba(189,133,120,.35)',
                  borderRadius: 10,
                  padding: '11px 14px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: DANGER }}>从 {agent.name} 取消全部复制</div>
                <div style={{ fontSize: 11.5, color: dim(0.5), marginTop: 2 }}>
                  移除该 Agent 的全部全局安装（中心存储 SSOT 保留）
                </div>
              </div>
            </div>
          )}

          {step === 'apply' && (
            <>
              <p style={{ margin: '14px 0 18px', fontSize: 12.5, lineHeight: 1.8, color: dim(0.6) }}>
                将把当前 <b style={{ color: INK }}>{rows.length}</b> 个技能补齐到{' '}
                <b style={{ color: INK }}>{agent.name}</b>，内容不变、已有安装跳过。确认执行？
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <span
                  onClick={close}
                  style={{
                    border: '1px solid rgba(63,68,56,.14)',
                    color: dim(0.7),
                    fontSize: 12.5,
                    borderRadius: 9,
                    padding: '7px 16px',
                    cursor: 'pointer',
                  }}
                >
                  取消
                </span>
                <span
                  className="rp-btn-grad"
                  onClick={runAgentAction}
                  style={{
                    ...gradBtn,
                    fontSize: 12.5,
                    borderRadius: 9,
                    padding: '7px 18px',
                    opacity: actionBusy ? 0.6 : undefined,
                  }}
                >
                  {actionBusy ? '执行中…' : `确认补齐 (${rows.length})`}
                </span>
              </div>
            </>
          )}

          {step === 'remove' && (
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
                ⚠ 将移除 <b>{agent.name}</b> 的 <b>{removeCount}</b> 处全局安装（技能内容在中心存储保留，
                项目作用域安装不受影响）。
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <span
                  onClick={close}
                  style={{
                    border: '1px solid rgba(63,68,56,.14)',
                    color: dim(0.7),
                    fontSize: 12.5,
                    borderRadius: 9,
                    padding: '7px 16px',
                    cursor: 'pointer',
                  }}
                >
                  取消
                </span>
                <span
                  onClick={runAgentAction}
                  style={{
                    background: DANGER,
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 12.5,
                    borderRadius: 9,
                    padding: '7px 18px',
                    cursor: 'pointer',
                    opacity: actionBusy ? 0.6 : undefined,
                  }}
                >
                  {actionBusy ? '执行中…' : `确认移除 (${removeCount})`}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ---- 「仅项目」分组 ----
  const renderProjectGroups = (): ReactElement => {
    const byPath = new Map<string, InstallRecord[]>();
    for (const i of scoped) {
      const list = byPath.get(i.scope) ?? [];
      list.push(i);
      byPath.set(i.scope, list);
    }
    const paths = [...byPath.keys()].sort();
    if (paths.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '80px 0', color: dim(0.45) }}>
          <div style={{ fontSize: 14 }}>暂无项目作用域的技能</div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: 'rgba(75,80,64,.35)' }}>
            在侧边栏「项目 · 本地目录」点「＋」添加项目后，可把技能同步到项目目录
          </div>
        </div>
      );
    }
    return (
      <>
        {paths.map((path) => {
          const installs = byPath.get(path) ?? [];
          const project = snapshot.projects.find((p) => p.path === path);
          const name = project?.name ?? path.split(/[\\/]/).filter(Boolean).pop() ?? path;
          const groupRows = [...new Set(installs.map((i) => i.skill))]
            .sort()
            .map((n) => buildRow(n, installs.filter((i) => i.skill === n)))
            .filter(matchQuery);
          if (groupRows.length === 0 && q) return null;
          const closed = !!collapsed[path];
          return (
            <div key={path} style={{ marginBottom: 16 }}>
              <div
                className="rp-hover-row"
                onClick={() => setCollapsed((m) => ({ ...m, [path]: !m[path] }))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '7px 10px',
                  borderRadius: 9,
                  cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 10, color: dim(0.45), width: 12, flex: 'none' }}>
                  {closed ? '▸' : '▾'}
                </span>
                <span style={{ fontWeight: 800, fontSize: 13.5, color: INK, whiteSpace: 'nowrap' }}>{name}</span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: dim(0.4),
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {path}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11.5, color: dim(0.45), whiteSpace: 'nowrap', flex: 'none' }}>
                  {groupRows.length} 个技能
                </span>
              </div>
              {!closed && groupRows.map(renderRow)}
            </div>
          );
        })}
      </>
    );
  };

  const projectGrouped = view.kind === 'local' && scope === 'project';

  return (
    <>
      {/* 范围 chips + Agent 批量操作 + 计数 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
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
        {headerAgents.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid rgba(63,68,56,.1)',
              borderRadius: 999,
              padding: '4px 10px',
              background: '#ffffff',
              flex: 'none',
            }}
          >
            <span style={{ fontSize: 10.5, color: dim(0.4), whiteSpace: 'nowrap' }}>批量</span>
            {headerAgents.map((a) => (
              <span
                key={a.id}
                className="rp-chip"
                title={`${a.name} · 批量复制 / 取消复制`}
                onClick={() => setAgentAction({ agent: a, step: 'menu' })}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 7,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: '1px solid transparent',
                  flex: 'none',
                }}
              >
                <AgentIcon agentId={a.id} name={a.name} size={15} />
              </span>
            ))}
          </div>
        )}
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

      {/* 技能行 / 项目分组 */}
      {projectGrouped ? (
        renderProjectGroups()
      ) : (
        <>
          {rows.map(renderRow)}
          {rows.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: dim(0.45) }}>
              <div style={{ fontSize: 14 }}>此范围内暂无技能</div>
              <div style={{ fontSize: 12.5, marginTop: 6, color: 'rgba(75,80,64,.35)' }}>
                到「技能市场」安装，或换个筛选范围
              </div>
            </div>
          )}
        </>
      )}

      {renderAgentActionModal()}
    </>
  );
}
