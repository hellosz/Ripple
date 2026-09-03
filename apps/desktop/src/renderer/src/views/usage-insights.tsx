import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { UsageEvent, UsageSessionEntry } from '@ripple/hub';
import { AgentIcon } from '../agent-icons.js';
import { evidenceBadge } from '../components/usage-panel.js';
import { ripple } from '../ripple-api.js';
import { errText, useStore } from '../store.js';
import { DANGER, INK, MONO, PRIMARY, cardStyle, dim, fmtRelative, gradBtn, inputStyle, outlineBtn } from '../ui.js';

const baseOf = (p: string): string => p.split('/').filter(Boolean).pop() ?? p;

const sessionKey = (s: UsageSessionEntry): string => `${s.agent}\n${s.session_id}`;

/** 会话时间跨度：同刻只显示一个相对时间 */
function spanLabel(s: UsageSessionEntry): string {
  const from = fmtRelative(s.first_at);
  const to = fmtRelative(s.last_at);
  return from === to ? to : `${from} ~ ${to}`;
}

/** 全局使用分析：按 Agent / 会话粒度组织技能使用情况 */
export function UsageInsightsView(): ReactElement {
  const store = useStore();
  const { snapshot, view } = store;
  const enabled = snapshot?.settings.usage_collection.enabled ?? false;
  const [sessions, setSessions] = useState<UsageSessionEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [skillFilter, setSkillFilter] = useState<string | null>(view.usageSkill ?? null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [eventsByKey, setEventsByKey] = useState<Record<string, UsageEvent[] | 'loading' | 'error'>>({});
  const [scanning, setScanning] = useState(false);

  const load = useCallback((): void => {
    setSessions(null);
    setError(null);
    ripple
      .usageSessions()
      .then(setSessions)
      .catch((err: unknown) => setError(errText(err)));
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  // 从技能详情跳转时带初始技能过滤
  useEffect(() => {
    if (view.usageSkill) setSkillFilter(view.usageSkill);
  }, [view.usageSkill]);

  const agentName = (id: string): string => snapshot?.agents.find((a) => a.id === id)?.name ?? id;

  if (!enabled) {
    return (
      <div style={{ textAlign: 'center', padding: '110px 0', color: dim(0.5) }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>使用分析未开启</div>
        <p style={{ margin: '10px auto 20px', fontSize: 12.5, lineHeight: 1.9, maxWidth: 440 }}>
          开启后会读取本机各 Agent 的会话记录，提取技能调用元数据（技能名 / 时间 / 项目路径），
          按 Agent 与会话粒度展示使用情况。不保存对话内容，数据全部留在本地。
        </p>
        <span
          className="rp-btn-grad"
          onClick={() => {
            store.setSettingsTab('ai');
            store.setView({ kind: 'settings' });
          }}
          style={{ ...gradBtn, display: 'inline-block', fontSize: 12.5, padding: '8px 22px' }}
        >
          去设置开启使用采集
        </span>
      </div>
    );
  }

  // ---- 汇总与过滤选项（基于全量 sessions） ----
  const all = sessions ?? [];
  const totalEvents = all.reduce((n, s) => n + s.count, 0);
  const allSkills = [...new Set(all.flatMap((s) => Object.keys(s.skills)))].sort();
  const allAgents = [...new Set(all.map((s) => s.agent))];

  const filtered = all.filter(
    (s) =>
      (!agentFilter || s.agent === agentFilter) &&
      (!skillFilter || skillFilter in s.skills),
  );
  const byAgent = new Map<string, UsageSessionEntry[]>();
  for (const s of filtered) {
    const list = byAgent.get(s.agent) ?? [];
    list.push(s);
    byAgent.set(s.agent, list);
  }

  const toggleExpand = (s: UsageSessionEntry): void => {
    const key = sessionKey(s);
    if (expanded === key) {
      setExpanded(null);
      return;
    }
    setExpanded(key);
    if (!(key in eventsByKey)) {
      setEventsByKey((m) => ({ ...m, [key]: 'loading' }));
      ripple
        .usageEvents({ agent: s.agent, session_id: s.session_id })
        .then((events) => setEventsByKey((m) => ({ ...m, [key]: events })))
        .catch(() => setEventsByKey((m) => ({ ...m, [key]: 'error' })));
    }
  };

  const rescan = (): void => {
    if (scanning) return;
    setScanning(true);
    void (async () => {
      try {
        const r = await ripple.usageScan();
        store.toast(`扫描完成：新增 ${r.added} 条`);
        setEventsByKey({});
        load();
      } catch (err) {
        store.toast(`扫描失败：${errText(err)}`);
      } finally {
        setScanning(false);
      }
    })();
  };

  const skillChip = (name: string, count: number): ReactElement => (
    <span
      key={name}
      className="rp-chip"
      onClick={(e) => {
        e.stopPropagation();
        setSkillFilter(name);
      }}
      title={`按「${name}」过滤`}
      style={{
        fontSize: 10.5,
        fontFamily: MONO,
        padding: '2px 9px',
        borderRadius: 999,
        cursor: 'pointer',
        background: skillFilter === name ? 'rgba(147,168,107,.16)' : 'rgba(63,68,56,.05)',
        color: skillFilter === name ? PRIMARY : dim(0.6),
        whiteSpace: 'nowrap',
      }}
    >
      {name} × {count}
    </span>
  );

  return (
    <div style={{ maxWidth: 880 }}>
      {/* 汇总条 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14, flexWrap: 'wrap' }}>
        {(
          [
            ['总使用', `${totalEvents} 次`],
            ['会话', `${all.length} 个`],
            ['覆盖技能', `${allSkills.length} 个`],
          ] as const
        ).map(([label, value]) => (
          <span key={label} style={{ fontSize: 12.5, color: dim(0.5) }}>
            {label} <b style={{ color: INK, fontFamily: MONO, fontSize: 13.5 }}>{value}</b>
          </span>
        ))}
        <span style={{ flex: 1 }} />
        <span
          className="rp-btn-outline"
          onClick={rescan}
          style={{ ...outlineBtn, fontSize: 11.5, padding: '5px 14px', opacity: scanning ? 0.6 : undefined }}
        >
          {scanning ? '扫描中…' : '⟳ 重新扫描'}
        </span>
      </div>

      {/* 过滤 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span
          className="rp-chip"
          onClick={() => setAgentFilter(null)}
          style={{
            fontSize: 12,
            padding: '5px 12px',
            borderRadius: 999,
            cursor: 'pointer',
            border: `1px solid ${agentFilter === null ? 'rgba(107,127,67,.5)' : 'rgba(63,68,56,.12)'}`,
            color: agentFilter === null ? PRIMARY : dim(0.55),
            fontWeight: agentFilter === null ? 700 : undefined,
          }}
        >
          全部 Agent
        </span>
        {allAgents.map((id) => (
          <span
            key={id}
            className="rp-chip"
            onClick={() => setAgentFilter(agentFilter === id ? null : id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              padding: '5px 12px',
              borderRadius: 999,
              cursor: 'pointer',
              border: `1px solid ${agentFilter === id ? 'rgba(107,127,67,.5)' : 'rgba(63,68,56,.12)'}`,
              background: agentFilter === id ? 'rgba(147,168,107,.1)' : undefined,
              color: agentFilter === id ? PRIMARY : dim(0.55),
              fontWeight: agentFilter === id ? 700 : undefined,
            }}
          >
            <AgentIcon agentId={id} name={agentName(id)} size={14} />
            {agentName(id)}
          </span>
        ))}
        <span style={{ flex: 1 }} />
        <select
          value={skillFilter ?? ''}
          onChange={(e) => setSkillFilter(e.target.value || null)}
          style={{ ...inputStyle, fontSize: 12, padding: '5px 10px', minWidth: 170 }}
        >
          <option value="">全部技能</option>
          {allSkills.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {sessions === null && error === null && (
        <div style={{ textAlign: 'center', padding: '70px 0', color: dim(0.45), fontSize: 12.5 }}>加载中…</div>
      )}
      {error !== null && (
        <div style={{ textAlign: 'center', padding: '70px 0', color: DANGER, fontSize: 12.5 }}>加载失败：{error}</div>
      )}
      {sessions !== null && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '70px 0', color: dim(0.45), fontSize: 12.5 }}>
          {all.length === 0 ? '暂无使用记录：点「重新扫描」采集各 Agent 会话。' : '当前过滤条件下没有会话。'}
        </div>
      )}

      {/* Agent 分组会话列表 */}
      {[...byAgent.entries()].map(([agent, list]) => (
        <div key={agent} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px 2px' }}>
            <AgentIcon agentId={agent} name={agentName(agent)} size={17} />
            <span style={{ fontWeight: 900, fontSize: 13, color: INK }}>{agentName(agent)}</span>
            {evidenceBadge(agent)}
            <span style={{ fontSize: 11.5, color: dim(0.45), fontFamily: MONO }}>{list.length} 个会话</span>
          </div>
          {list.map((s) => {
            const key = sessionKey(s);
            const open = expanded === key;
            const chips = Object.entries(s.skills).sort((a, b) => b[1] - a[1]);
            const events = eventsByKey[key];
            return (
              <div key={key} style={{ ...cardStyle, marginBottom: 8, overflow: 'hidden' }}>
                <div
                  className="rp-hover-row"
                  onClick={() => toggleExpand(s)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 15px', cursor: 'pointer' }}
                >
                  <span style={{ color: dim(0.35), fontSize: 10, flex: 'none' }}>{open ? '▾' : '▸'}</span>
                  <span
                    title={s.session_id}
                    style={{ fontFamily: MONO, fontSize: 11.5, color: dim(0.6), whiteSpace: 'nowrap', flex: 'none' }}
                  >
                    {s.session_id.slice(0, 10)}…
                  </span>
                  {s.project_dir && (
                    <span
                      title={s.project_dir}
                      style={{
                        fontSize: 11,
                        fontFamily: MONO,
                        padding: '1px 8px',
                        borderRadius: 999,
                        background: 'rgba(63,68,56,.05)',
                        color: dim(0.55),
                        whiteSpace: 'nowrap',
                        flex: 'none',
                      }}
                    >
                      {baseOf(s.project_dir)}
                    </span>
                  )}
                  <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
                    {chips.slice(0, 4).map(([name, count]) => skillChip(name, count))}
                    {chips.length > 4 && (
                      <span style={{ fontSize: 10.5, color: dim(0.4), alignSelf: 'center' }}>+{chips.length - 4}</span>
                    )}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11.5, color: PRIMARY, fontWeight: 700, flex: 'none' }}>
                    {s.count} 次
                  </span>
                  <span
                    title={`${s.first_at} ~ ${s.last_at}`}
                    style={{ fontSize: 11, color: dim(0.4), whiteSpace: 'nowrap', flex: 'none', fontFamily: MONO }}
                  >
                    {spanLabel(s)}
                  </span>
                </div>
                {open && (
                  <div style={{ borderTop: '1px solid rgba(63,68,56,.07)', padding: '8px 15px 10px 33px' }}>
                    {events === 'loading' && (
                      <div style={{ fontSize: 12, color: dim(0.45), padding: '8px 0' }}>加载中…</div>
                    )}
                    {events === 'error' && (
                      <div style={{ fontSize: 12, color: DANGER, padding: '8px 0' }}>明细加载失败</div>
                    )}
                    {Array.isArray(events) &&
                      events.map((e) => (
                        <div
                          key={e.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: 12 }}
                        >
                          <span
                            title={e.occurred_at}
                            style={{ fontFamily: MONO, fontSize: 11, color: dim(0.45), width: 92, flex: 'none' }}
                          >
                            {fmtRelative(e.occurred_at)}
                          </span>
                          <span style={{ fontFamily: MONO, fontWeight: 700, color: INK }}>{e.skill}</span>
                          {evidenceBadge(e.agent)}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
