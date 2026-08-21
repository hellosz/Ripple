import { useState } from 'react';
import type { ReactElement } from 'react';
import type { CommunitySkill } from '@ripple/hub';
import { ripple } from '../ripple-api.js';
import { errText, useStore } from '../store.js';
import {
  AMBER,
  DANGER,
  GREEN_DEEP,
  INK,
  MONO,
  PRIMARY,
  REPO_BLUE,
  cardStyle,
  dim,
  fmtRelative,
  outlineBtn,
} from '../ui.js';

/** GitHub / GitLab provider 徽标 */
function ProviderBadge({ provider }: { provider: 'github' | 'gitlab' }): ReactElement {
  const isGithub = provider === 'github';
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 800,
        padding: '2px 8px',
        borderRadius: 999,
        background: isGithub ? 'rgba(63,68,56,.08)' : 'rgba(226,109,50,.12)',
        color: isGithub ? INK : '#c26026',
        whiteSpace: 'nowrap',
        flex: 'none',
        fontFamily: MONO,
      }}
    >
      {isGithub ? 'GitHub' : 'GitLab'}
    </span>
  );
}

function Skeleton(): ReactElement {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ ...cardStyle, padding: '16px 18px', marginBottom: 10 }}>
          <div
            style={{
              height: 13,
              width: 180 + i * 40,
              borderRadius: 6,
              background: 'rgba(75,80,64,.09)',
              marginBottom: 10,
            }}
          />
          <div style={{ height: 11, width: '60%', borderRadius: 6, background: 'rgba(75,80,64,.06)' }} />
        </div>
      ))}
    </>
  );
}

/** 社区开源一级视图：来源仓库分组的技能列表（无需登录） */
export function CommunityView(): ReactElement {
  const store = useStore();
  const { snapshot, community, communityError, query } = store;
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const sources = snapshot?.sources ?? [];
  const defaultAgent = snapshot?.settings.default_agent ?? 'claude-code';
  const agentName = snapshot?.agents.find((a) => a.id === defaultAgent)?.name ?? defaultAgent;

  const install = (c: CommunitySkill, isUpdate: boolean): void => {
    const key = `${c.sourceId}\n${c.name}`;
    if (busy[key]) return;
    setBusy((m) => ({ ...m, [key]: true }));
    void (async () => {
      try {
        // 更新时覆盖既有安装目标；首次安装到默认 Agent
        const existing = (snapshot?.installs ?? [])
          .filter((i) => i.skill === c.name)
          .map((i) => (i.scope === 'global' ? { agent: i.agent } : { agent: i.agent, projectDir: i.scope }));
        const targets = isUpdate && existing.length > 0 ? existing : [{ agent: defaultAgent }];
        await ripple.installFromRepo(c.sourceId, c.name, targets);
        await store.refresh();
        await store.loadCommunity(true);
        store.toast(isUpdate ? `已从仓库更新「${c.name}」` : `已安装「${c.name}」到 ${agentName}`);
      } catch (err) {
        store.toast(`${isUpdate ? '更新' : '安装'}失败：${errText(err)}`);
      } finally {
        setBusy((m) => ({ ...m, [key]: false }));
      }
    })();
  };

  const q = query.trim();
  const items = (community ?? []).filter(
    (c) => !q || c.name.includes(q) || c.description.includes(q),
  );

  const bySource = new Map<string, CommunitySkill[]>();
  for (const c of items) {
    const list = bySource.get(c.sourceId) ?? [];
    list.push(c);
    bySource.set(c.sourceId, list);
  }
  const sourceIds = [...bySource.keys()].sort();

  const loading = community === null && communityError === null;

  return (
    <>
      {/* 说明行 + 刷新 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 12.5, color: dim(0.55) }}>
          来自 GitHub / GitLab 技能仓库，本地即可浏览与安装，无需登录。
        </span>
        <span style={{ flex: 1 }} />
        <span
          className="rp-btn-outline"
          onClick={() => void store.loadCommunity(true)}
          style={{ ...outlineBtn, fontSize: 12, padding: '6px 14px', flex: 'none' }}
        >
          ⟳ 刷新
        </span>
      </div>

      {loading && <Skeleton />}

      {!loading && communityError !== null && community === null && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: dim(0.5) }}>
          <div style={{ fontSize: 14, color: DANGER }}>加载失败：{communityError}</div>
          <span
            className="rp-btn-outline"
            onClick={() => void store.loadCommunity(true)}
            style={{ ...outlineBtn, display: 'inline-block', fontSize: 12.5, padding: '7px 18px', marginTop: 14 }}
          >
            重试
          </span>
        </div>
      )}

      {!loading && community !== null && sourceIds.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: dim(0.5) }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>
            {sources.length === 0 ? '还没有绑定技能仓库来源' : q ? '没有匹配的技能' : '来源仓库内暂无技能'}
          </div>
          {sources.length === 0 && (
            <>
              <p style={{ margin: '8px auto 18px', fontSize: 12.5, lineHeight: 1.8, maxWidth: 340 }}>
                在设置中添加 GitHub / GitLab 仓库后，这里会列出仓库内的全部技能，支持直接安装与更新。
              </p>
              <span
                className="rp-btn-outline"
                onClick={() => {
                  store.setSettingsTab('sources');
                  store.setView({ kind: 'settings' });
                }}
                style={{ ...outlineBtn, display: 'inline-block', fontSize: 12.5, padding: '8px 20px' }}
              >
                去设置添加来源
              </span>
            </>
          )}
        </div>
      )}

      {!loading &&
        sourceIds.map((sid) => {
          const source = sources.find((s) => s.id === sid);
          const provider: 'github' | 'gitlab' = source?.provider ?? 'github';
          const label = source
            ? `${source.host ? `${source.host}/` : ''}${source.owner}/${source.repo}` +
              (source.subdir ? ` › ${source.subdir}` : '')
            : sid;
          const list = bySource.get(sid) ?? [];
          return (
            <div key={sid} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '2px 4px 8px' }}>
                <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 13, color: INK, whiteSpace: 'nowrap' }}>
                  {label}
                </span>
                <ProviderBadge provider={provider} />
                {source?.branch && (
                  <span style={{ fontFamily: MONO, fontSize: 11, color: dim(0.4), whiteSpace: 'nowrap' }}>
                    {source.branch}
                  </span>
                )}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11.5, color: dim(0.45), whiteSpace: 'nowrap' }}>{list.length} 个技能</span>
              </div>
              <div style={{ ...cardStyle, overflow: 'hidden' }}>
                {list.map((c, idx) => {
                  const key = `${c.sourceId}\n${c.name}`;
                  return (
                    <div
                      key={c.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '13px 18px',
                        borderTop: idx === 0 ? undefined : '1px dashed rgba(63,68,56,.07)',
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: INK, whiteSpace: 'nowrap' }}>{c.name}</span>
                          <span style={{ fontFamily: MONO, fontSize: 11.5, color: PRIMARY, whiteSpace: 'nowrap' }}>
                            v{c.version}
                          </span>
                          {c.installed && !c.changed && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 999,
                                background: 'rgba(127,165,136,.12)',
                                color: GREEN_DEEP,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              已安装
                            </span>
                          )}
                          {c.installed && c.changed && (
                            <span
                              title="仓库内容与本地版本指纹不一致"
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 999,
                                background: 'rgba(169,138,91,.12)',
                                color: AMBER,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              有更新
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: dim(0.45),
                            marginTop: 3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.description || '暂无简介'}
                        </div>
                      </div>
                      <span
                        title={c.remoteUpdatedAt ?? '仓库未提供更新时间'}
                        style={{
                          fontSize: 11.5,
                          color: dim(0.4),
                          whiteSpace: 'nowrap',
                          flex: 'none',
                          fontFamily: MONO,
                        }}
                      >
                        {c.remoteUpdatedAt ? fmtRelative(c.remoteUpdatedAt) : '—'}
                      </span>
                      {!c.installed && (
                        <span
                          className="rp-btn-outline"
                          onClick={() => install(c, false)}
                          style={{
                            ...outlineBtn,
                            fontSize: 11.5,
                            padding: '5px 14px',
                            flex: 'none',
                            opacity: busy[key] ? 0.5 : undefined,
                          }}
                        >
                          {busy[key] ? '安装中…' : '安装'}
                        </span>
                      )}
                      {c.installed && c.changed && (
                        <span
                          onClick={() => install(c, true)}
                          style={{
                            border: `1px solid ${REPO_BLUE}66`,
                            color: REPO_BLUE,
                            fontWeight: 700,
                            fontSize: 11.5,
                            borderRadius: 8,
                            padding: '5px 14px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            flex: 'none',
                            opacity: busy[key] ? 0.5 : undefined,
                          }}
                        >
                          {busy[key] ? '更新中…' : '更新'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
    </>
  );
}
