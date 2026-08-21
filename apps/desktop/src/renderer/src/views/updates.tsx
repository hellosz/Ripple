import { useState } from 'react';
import type { ReactElement } from 'react';
import type { CommunitySkill } from '@ripple/hub';
import type { UpdateEntry } from '../../../shared/api.js';
import { ripple } from '../ripple-api.js';
import { errText, useStore } from '../store.js';
import { INK, MONO, PRIMARY, REPO_BLUE, cardStyle, dim, gradBtn, outlineBtn } from '../ui.js';

function SectionHeader({ title, count, hint }: { title: string; count: number | null; hint?: string }): ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 4px 10px' }}>
      <span style={{ fontWeight: 800, fontSize: 13.5, color: INK, whiteSpace: 'nowrap' }}>{title}</span>
      {count !== null && count > 0 && (
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            background: 'rgba(147,168,107,.14)',
            color: PRIMARY,
            borderRadius: 999,
            padding: '1px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          {count}
        </span>
      )}
      <span style={{ flex: 1 }} />
      {hint && <span style={{ fontSize: 11.5, color: dim(0.4), whiteSpace: 'nowrap' }}>{hint}</span>}
    </div>
  );
}

/** 更新中心：技能市场更新 + 社区开源更新（指纹变化）两节 */
export function UpdatesView(): ReactElement {
  const store = useStore();
  const { snapshot, updates, loggedIn, community } = store;
  const [busy, setBusy] = useState<Record<string, boolean>>({});

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

  const updateCommunity = (c: CommunitySkill): void => {
    const key = `${c.sourceId}\n${c.name}`;
    if (busy[key]) return;
    setBusy((m) => ({ ...m, [key]: true }));
    void (async () => {
      try {
        const targets = (snapshot?.installs ?? [])
          .filter((i) => i.skill === c.name)
          .map((i) => (i.scope === 'global' ? { agent: i.agent } : { agent: i.agent, projectDir: i.scope }));
        await ripple.installFromRepo(
          c.sourceId,
          c.name,
          targets.length ? targets : [{ agent: snapshot?.settings.default_agent ?? 'claude-code' }],
        );
        await store.refresh();
        await store.loadCommunity(true);
        store.toast(`已从仓库更新「${c.name}」`);
      } catch (err) {
        store.toast(`更新失败：${errText(err)}`);
      } finally {
        setBusy((m) => ({ ...m, [key]: false }));
      }
    })();
  };

  const communityUpdates = (community ?? []).filter((c) => c.installed && c.changed);
  const repoLabel = (sourceId: string): string => {
    const s = snapshot?.sources.find((r) => r.id === sourceId);
    return s ? `${s.host ? `${s.host}/` : ''}${s.owner}/${s.repo}` : sourceId;
  };

  return (
    <>
      {/* 技能市场 */}
      <div style={{ marginBottom: 22 }}>
        <SectionHeader
          title="技能市场"
          count={loggedIn ? updates.length : null}
          hint={loggedIn ? '来自远程注册表的新版本' : undefined}
        />
        {!loggedIn && (
          <div
            style={{
              ...cardStyle,
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 12.5,
              color: dim(0.55),
            }}
          >
            登录远程服务后可检查技能市场更新。
            <span style={{ flex: 1 }} />
            <span
              className="rp-btn-outline"
              onClick={() => store.setLoginOpen(true)}
              style={{ ...outlineBtn, fontSize: 12, padding: '6px 16px', flex: 'none' }}
            >
              配置并登录
            </span>
          </div>
        )}
        {loggedIn &&
          updates.map((u) => (
            <div
              key={u.skill}
              style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px', marginBottom: 10 }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: INK }}>{u.skill}</div>
                <div style={{ fontSize: 11.5, color: dim(0.5), marginTop: 2 }}>
                  {snapshot?.skills[u.skill]?.description ?? '来自远程注册表的新版本'}
                </div>
              </div>
              <span style={{ fontFamily: MONO, fontSize: 12, color: dim(0.45), whiteSpace: 'nowrap' }}>
                v{u.current ?? '—'} → <span style={{ color: PRIMARY, fontWeight: 700 }}>v{u.latest}</span>
              </span>
              <span style={{ fontSize: 11.5, color: dim(0.45), whiteSpace: 'nowrap' }}>{u.targets} 处安装</span>
              <span
                className="rp-btn-grad"
                onClick={() => updateOne(u)}
                style={{ ...gradBtn, fontSize: 12, padding: '7px 16px' }}
              >
                更新
              </span>
            </div>
          ))}
        {loggedIn && updates.length === 0 && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '26px 0', color: dim(0.45), fontSize: 13 }}>
            ✓ 市场安装的技能都是最新的
          </div>
        )}
      </div>

      {/* 社区开源 */}
      <div>
        <SectionHeader title="社区开源" count={communityUpdates.length} hint="来源仓库指纹变化" />
        {communityUpdates.map((c) => (
          <div
            key={`${c.sourceId}-${c.name}`}
            style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px', marginBottom: 10 }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: INK, whiteSpace: 'nowrap' }}>{c.name}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(75,127,176,.12)',
                    color: REPO_BLUE,
                    whiteSpace: 'nowrap',
                  }}
                >
                  社区
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: dim(0.5), marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                来自 {repoLabel(c.sourceId)} · {c.description || '仓库内容有更新'}
              </div>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 12, color: dim(0.45), whiteSpace: 'nowrap' }}>
              v{c.version}
            </span>
            <span
              onClick={() => updateCommunity(c)}
              style={{
                border: `1px solid ${REPO_BLUE}66`,
                color: REPO_BLUE,
                fontWeight: 700,
                fontSize: 12,
                borderRadius: 8,
                padding: '7px 16px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                opacity: busy[`${c.sourceId}\n${c.name}`] ? 0.5 : undefined,
              }}
            >
              {busy[`${c.sourceId}\n${c.name}`] ? '更新中…' : '更新'}
            </span>
          </div>
        ))}
        {communityUpdates.length === 0 && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '26px 0', color: dim(0.45), fontSize: 13 }}>
            {community === null ? '正在检查来源仓库…' : '✓ 社区来源的技能都是最新的'}
          </div>
        )}
      </div>
    </>
  );
}
