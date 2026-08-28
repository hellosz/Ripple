import { useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { AgentSummary } from '../../../shared/api.js';
import sideBg from '../assets/side-bg.avif';
import { AgentIcon } from '../agent-icons.js';
import { ripple } from '../ripple-api.js';
import { useStore } from '../store.js';
import { HERO_BG, MONO, PRIMARY, dim, hostOf } from '../ui.js';

const navBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  fontSize: 13,
  padding: '8px 10px',
  borderRadius: 9,
  cursor: 'pointer',
  marginBottom: 1,
};

const activeNav: CSSProperties = {
  background: 'rgba(147,168,107,.12)',
  color: PRIMARY,
  fontWeight: 700,
};

function Logo({ size }: { size: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="14" r="2.4" fill="#faf9f2" />
      <path d="M16 22 A8 8 0 0 1 8 14" stroke="#e3e8d2" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".9" />
      <path d="M16 22 A8 8 0 0 0 24 14" stroke="#e3e8d2" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".9" />
      <path d="M16 26 A12 12 0 0 1 4 14" stroke="#d3dcbc" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity=".6" />
      <path d="M16 26 A12 12 0 0 0 28 14" stroke="#d3dcbc" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity=".6" />
    </svg>
  );
}

export function Sidebar(): ReactElement {
  const store = useStore();
  const { snapshot, auth, loggedIn, updates, community, view } = store;
  const agents = snapshot?.agents ?? [];
  const projects = snapshot?.projects ?? [];
  const installs = snapshot?.installs ?? [];
  const [unusedOpen, setUnusedOpen] = useState(false);

  const emailPrefix = auth?.user?.email?.split('@')[0] ?? '';
  const nickname = auth?.user?.nickname ?? emailPrefix;
  const communityUpdates = (community ?? []).filter((c) => c.installed && c.changed).length;

  // 有技能的 Agent 置顶：有安装记录，或（支持共享目录标准 + 共享存储 + 共享库非空）
  const sharedLibCount = Object.keys(snapshot?.skills ?? {}).length;
  const storageShared = snapshot?.settings.storage_location === 'shared';
  const hasSkills = (a: AgentSummary): boolean =>
    a.installCount > 0 || (a.sharedDirSupport && storageShared && sharedLibCount > 0);
  const usedAgents = agents.filter(hasSkills);
  const unusedAgents = agents.filter((a) => !hasSkills(a));

  const renderAgentRow = (a: AgentSummary): ReactElement => {
    const active = view.kind === 'agent' && view.agentId === a.id;
    return (
      <div
        key={a.id}
        className="rp-hover-row"
        onClick={() => store.setView({ kind: 'agent', agentId: a.id })}
        title={a.detected ? a.name : `${a.name} · 未检测到本地目录`}
        style={{
          ...navBase,
          fontSize: 12.5,
          color: dim(a.detected ? 0.75 : 0.4),
          ...(active ? activeNav : {}),
        }}
      >
        <span style={{ flex: 'none', display: 'inline-flex', opacity: a.detected ? 1 : 0.4 }}>
          <AgentIcon agentId={a.id} name={a.name} size={16} />
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, color: dim(0.4) }}>
          {a.installCount}
        </span>
      </div>
    );
  };

  // 更新中心徽标 = 市场更新（需登录）+ 社区开源指纹变化
  const updateBadge = (loggedIn ? updates.length : 0) + communityUpdates;
  const mainNav: {
    key: 'local' | 'market' | 'community' | 'updates';
    icon: string;
    name: string;
    badge: number | null;
    locked: boolean;
  }[] = [
    { key: 'local', icon: '▦', name: '本地技能', badge: null, locked: false },
    { key: 'market', icon: '◎', name: '技能市场', badge: null, locked: !loggedIn },
    { key: 'community', icon: '⌂', name: '社区开源', badge: null, locked: false },
    {
      key: 'updates',
      icon: '↻',
      name: '更新中心',
      badge: updateBadge > 0 ? updateBadge : null,
      locked: false,
    },
  ];

  const rescan = (): void => {
    store.run(async () => {
      // 先接管既有技能（unmanaged → 纳入管理），再报告剩余问题
      const { adopted, skipped } = await ripple.adoptAll();
      const issues = await ripple.scan();
      const snap = await store.refresh();
      store.setLastScan(new Date());
      const agentCount = (snap?.agents ?? agents).length;
      const projectCount = (snap?.projects ?? projects).length;
      store.toast(
        `扫描完成：${agentCount} 个 Agent 目录、${projectCount} 个项目目录` +
          (adopted ? ` · 接管 ${adopted} 个既有技能` : '') +
          (skipped ? ` · ${skipped} 个目录无 SKILL.md 跳过` : '') +
          (issues.length ? ` · ${issues.length} 个问题` : ''),
      );
    });
  };

  const addProject = (): void => {
    store.run(async () => {
      const rec = await ripple.addProjectDialog();
      if (!rec) return;
      await store.refresh();
      store.toast(`已添加项目 ${rec.name}`);
    });
  };

  const removeProject = (path: string, name: string): void => {
    store.run(async () => {
      await ripple.removeProject(path);
      if (store.view.kind === 'project' && store.view.projectPath === path) {
        store.setView({ kind: 'local' });
      }
      await store.refresh();
      store.toast(`已移除项目 ${name}（技能文件保留）`);
    });
  };

  return (
    <div
      style={{
        width: 230,
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(63,68,56,.08)',
        background: '#f1efe4',
        padding: '0 10px 14px',
        minHeight: 0,
      }}
    >
      {/* 品牌区 + 连接状态卡：登录态=头图+昵称；未登录=整体置灰，仅 Logo + Ripple */}
      <div
        onClick={loggedIn ? undefined : () => store.setLoginOpen(true)}
        style={{
          position: 'relative',
          overflow: 'hidden',
          margin: '0 -10px 12px',
          padding: '14px 12px 12px',
          cursor: loggedIn ? undefined : 'pointer',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            // 头图打包内置；加载异常时露出同色系渐变兜底；未登录整体灰化
            backgroundImage: `url(${sideBg}), ${HERO_BG}`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: loggedIn ? undefined : 'grayscale(1) brightness(.8)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg,rgba(38,46,38,.45) 0%,rgba(38,46,38,.78) 100%)',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: loggedIn ? '0 4px 12px' : '4px 4px 6px',
          }}
        >
          <Logo size={22} />
          <span
            style={{
              fontFamily: "'Space Grotesk',sans-serif",
              fontWeight: 700,
              fontSize: 16,
              lineHeight: 1,
              color: '#faf9f2',
            }}
          >
            Ripple
          </span>
        </div>
        {loggedIn ? (
          <div
            className="rp-conn-card"
            onClick={() => store.setLoginOpen(true)}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '9px 11px',
              borderRadius: 10,
              border: '1px solid rgba(250,249,242,.28)',
              background: 'rgba(250,249,242,.12)',
              backdropFilter: 'blur(6px)',
              cursor: 'pointer',
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: '#7fa588' }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#faf9f2',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {nickname}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: 'rgba(250,249,242,.6)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: MONO,
                  marginTop: 1,
                }}
              >
                {hostOf(auth?.server ?? '')}
              </div>
            </div>
            <span style={{ color: 'rgba(250,249,242,.55)', fontSize: 11, flex: 'none' }}>⚙</span>
          </div>
        ) : (
          <div
            style={{
              position: 'relative',
              fontSize: 10.5,
              color: 'rgba(250,249,242,.55)',
              padding: '0 4px 2px',
            }}
          >
            本地模式 · 点击登录
          </div>
        )}
      </div>

      {/* 主导航 */}
      {mainNav.map((n) => (
        <div
          key={n.key}
          className="rp-hover-row"
          onClick={() => store.setView({ kind: n.key })}
          style={{ ...navBase, color: dim(0.75), ...(view.kind === n.key ? activeNav : {}) }}
        >
          <span style={{ width: 16, textAlign: 'center', flex: 'none' }}>{n.icon}</span>
          <span style={{ whiteSpace: 'nowrap' }}>{n.name}</span>
          <span style={{ flex: 1 }} />
          {n.badge !== null && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                background: '#93a86b',
                color: '#ffffff',
                borderRadius: 999,
                padding: '1px 7px',
              }}
            >
              {n.badge}
            </span>
          )}
          {n.locked && (
            <span title="需登录远程服务" style={{ fontSize: 11, color: 'rgba(75,80,64,.35)' }}>
              🔒
            </span>
          )}
        </div>
      ))}

      {/* AGENT · 全局 */}
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '.22em',
          color: dim(0.4),
          padding: '16px 10px 6px',
          whiteSpace: 'nowrap',
        }}
      >
        AGENT · 全局
      </div>
      {usedAgents.map(renderAgentRow)}
      {unusedAgents.length > 0 && (
        <div
          className="rp-hover-row"
          onClick={() => setUnusedOpen((o) => !o)}
          style={{ ...navBase, fontSize: 11.5, color: dim(0.45) }}
        >
          <span style={{ width: 16, textAlign: 'center', flex: 'none', fontSize: 10 }}>
            {unusedOpen ? '▾' : '▸'}
          </span>
          <span style={{ whiteSpace: 'nowrap' }}>未使用 ({unusedAgents.length})</span>
        </div>
      )}
      {unusedOpen && unusedAgents.map(renderAgentRow)}

      {/* 项目 · 本地目录 */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 10px 6px' }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '.22em',
            color: dim(0.4),
            whiteSpace: 'nowrap',
          }}
        >
          项目 · 本地目录
        </span>
        <span style={{ flex: 1 }} />
        <span
          className="rp-hover-primary"
          onClick={addProject}
          title="添加项目目录"
          style={{ fontSize: 14, color: dim(0.45), cursor: 'pointer', padding: '0 4px', borderRadius: 5 }}
        >
          ＋
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {projects.map((p) => {
          const active = view.kind === 'project' && view.projectPath === p.path;
          const count = installs.filter((i) => i.scope === p.path).length;
          return (
            <div
              key={p.path}
              className="rp-hover-row"
              onClick={() => store.setView({ kind: 'project', projectPath: p.path })}
              onContextMenu={(e) => {
                e.preventDefault();
                removeProject(p.path, p.name);
              }}
              style={{ ...navBase, fontSize: 12.5, color: dim(0.75), ...(active ? activeNav : {}) }}
            >
              <span style={{ flex: 'none', color: dim(0.4) }}>▸</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              <span style={{ flex: 1 }} />
              <span
                className="rp-proj-x rp-hover-danger"
                title="移除项目"
                onClick={(e) => {
                  e.stopPropagation();
                  removeProject(p.path, p.name);
                }}
                style={{ flex: 'none', color: dim(0.35), padding: '0 2px' }}
              >
                ✕
              </span>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, color: dim(0.4) }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* 重新扫描 / 设置 */}
      <div
        className="rp-hover-row rp-hover-primary"
        onClick={rescan}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: dim(0.55),
          padding: '9px 10px',
          borderRadius: 9,
          cursor: 'pointer',
          flex: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        ⟳ 重新扫描本地目录
      </div>
      <div
        className="rp-hover-row rp-hover-primary"
        onClick={() => store.setView({ kind: 'settings' })}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          padding: '9px 10px',
          borderRadius: 9,
          cursor: 'pointer',
          flex: 'none',
          whiteSpace: 'nowrap',
          ...(view.kind === 'settings'
            ? { background: 'rgba(147,168,107,.14)', color: PRIMARY, fontWeight: 700 }
            : { color: dim(0.55) }),
        }}
      >
        ⚙ 设置
      </div>
    </div>
  );
}
