import { useEffect, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { SkillQualitySignal, UsageEvent, UsageSessionEntry, UsageStatEntry } from '@ripple/hub';
import { AgentIcon } from '../agent-icons.js';
import { ripple } from '../ripple-api.js';
import { errText, useStore } from '../store.js';
import { AMBER, DANGER, GREEN_DEEP, INK, MONO, PRIMARY, dim, fmtRelative, gradBtn, outlineBtn } from '../ui.js';

/** 证据等级标注：codex/deepseek-harness 为路径启发式，其余 probe 为结构化工具调用 */
export function evidenceBadge(agent: string): ReactElement {
  const heuristic = agent === 'codex' || agent === 'deepseek-harness';
  return (
    <span
      title={
        heuristic
          ? '路径启发：从会话记录中读取 SKILL.md 的命令推断，仅作参考信号'
          : '工具调用：会话记录中的结构化技能调用，证据可靠'
      }
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        padding: '1px 7px',
        borderRadius: 999,
        background: heuristic ? 'rgba(169,138,91,.12)' : 'rgba(127,165,136,.12)',
        color: heuristic ? AMBER : GREEN_DEEP,
        whiteSpace: 'nowrap',
        flex: 'none',
      }}
    >
      {heuristic ? '路径启发' : '工具调用'}
    </span>
  );
}

const baseOf = (p: string): string => p.split('/').filter(Boolean).pop() ?? p;

/** 质量信号标签样式与建议动作（与 hub qualitySignals 的标签枚举对齐） */
export const QUALITY_LABEL_META: Record<string, { tip: string; color: string; bg: string }> = {
  触发失灵: {
    tip: '多为手动唤起，自动触发失灵——建议重写 description 触发词',
    color: AMBER,
    bg: 'rgba(169,138,91,.12)',
  },
  '死重 references': {
    tip: 'references 从未被读，考虑删除或并回正文',
    color: DANGER,
    bg: 'rgba(189,133,120,.14)',
  },
  淘汰候选: {
    tip: '90 天以上未使用或从未使用，考虑卸载归档',
    color: 'rgba(63,68,56,.55)',
    bg: 'rgba(63,68,56,.08)',
  },
  'token 冗长嫌疑': {
    tip: '同一会话被反复加载，正文可能过长，考虑精简/外移',
    color: '#6a76c2',
    bg: 'rgba(106,118,194,.11)',
  },
};

/** 质量标签 chip（hover 显示解释与建议动作） */
export function qualityLabelChip(label: string): ReactElement {
  const meta = QUALITY_LABEL_META[label] ?? { tip: label, color: 'rgba(63,68,56,.55)', bg: 'rgba(63,68,56,.06)' };
  return (
    <span
      key={label}
      title={meta.tip}
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        padding: '1px 8px',
        borderRadius: 999,
        background: meta.bg,
        color: meta.color,
        whiteSpace: 'nowrap',
        flex: 'none',
        cursor: 'help',
      }}
    >
      {label}
    </span>
  );
}

/** 技能详情「使用」区块：Agent 分布 / 次数 / 最近使用 / 项目分布 / 证据等级 */
export function UsageBlock({
  skill,
  onGoSettings,
}: {
  skill: string;
  onGoSettings: () => void;
}): ReactElement {
  const store = useStore();
  const enabled = store.snapshot?.settings.usage_collection.enabled ?? false;
  const [stats, setStats] = useState<UsageStatEntry[] | null>(null);
  const [sessions, setSessions] = useState<UsageSessionEntry[] | null>(null);
  const [events, setEvents] = useState<UsageEvent[] | null>(null);
  const [quality, setQuality] = useState<SkillQualitySignal | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    Promise.all([
      ripple.usageStats(skill),
      ripple.usageSessions({ skill }),
      ripple.usageEvents({ skill, limit: 8 }),
      ripple.usageQuality(),
    ])
      .then(([st, se, ev, q]) => {
        if (!alive) return;
        setStats(st);
        setSessions(se);
        setEvents(ev);
        setQuality(q.find((item) => item.skill === skill) ?? null);
      })
      .catch((err: unknown) => {
        if (alive) setError(errText(err));
      });
    return () => {
      alive = false;
    };
  }, [skill, enabled]);

  if (!enabled) {
    return (
      <div style={{ textAlign: 'center', padding: '90px 0', color: dim(0.5) }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>使用分析未开启</div>
        <p style={{ margin: '10px auto 20px', fontSize: 12.5, lineHeight: 1.9, maxWidth: 420 }}>
          开启后会读取本机各 Agent 的会话记录，提取该技能被调用的元数据（技能名 / 时间 / 项目路径），
          不保存对话内容，数据全部留在本地。
        </p>
        <span
          className="rp-btn-grad"
          onClick={onGoSettings}
          style={{ ...gradBtn, display: 'inline-block', fontSize: 12.5, padding: '8px 22px' }}
        >
          去设置开启使用采集
        </span>
      </div>
    );
  }

  const total = (stats ?? []).reduce((n, s) => n + s.count, 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flex: 'none' }}>
        <span style={{ fontWeight: 900, fontSize: 13.5, color: INK }}>使用分析</span>
        {stats !== null && stats.length > 0 && (
          <span style={{ fontSize: 11.5, color: dim(0.45), fontFamily: MONO }}>共 {total} 次</span>
        )}
        {quality !== null && quality.labels.length > 0 && (
          <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap' }}>
            {quality.labels.map(qualityLabelChip)}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span
          className="rp-btn-outline"
          onClick={() => {
            setStats(null);
            setSessions(null);
            setEvents(null);
            void ripple
              .usageScan()
              .then(async (r) => {
                store.toast(`扫描完成：新增 ${r.added} 条`);
                setStats(await ripple.usageStats(skill));
                setSessions(await ripple.usageSessions({ skill }));
                setEvents(await ripple.usageEvents({ skill, limit: 8 }));
                setQuality((await ripple.usageQuality()).find((item) => item.skill === skill) ?? null);
              })
              .catch((err: unknown) => {
                store.toast(`扫描失败：${errText(err)}`);
                setStats([]);
              });
          }}
          style={{ ...outlineBtn, fontSize: 11.5, padding: '4px 13px', flex: 'none' }}
        >
          ⟳ 重新扫描
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {stats === null && error === null && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: dim(0.45), fontSize: 12.5 }}>加载中…</div>
        )}
        {error !== null && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: DANGER, fontSize: 12.5 }}>
            加载失败：{error}
          </div>
        )}
        {stats !== null && stats.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: dim(0.45), fontSize: 12.5 }}>
            暂无使用记录：该技能尚未在已采集的 Agent 会话中被调用。
          </div>
        )}
        {(stats ?? []).map((s) => {
          const agentName = store.snapshot?.agents.find((a) => a.id === s.agent)?.name ?? s.agent;
          const projects = Object.entries(s.projects)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
          return (
            <div
              key={s.agent}
              style={{
                border: '1px solid rgba(63,68,56,.09)',
                borderRadius: 12,
                padding: '12px 16px',
                marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
                <AgentIcon agentId={s.agent} name={agentName} size={16} />
                <span style={{ fontWeight: 800, color: INK, whiteSpace: 'nowrap' }}>{agentName}</span>
                {evidenceBadge(s.agent)}
                <span style={{ fontFamily: MONO, fontSize: 12, color: PRIMARY, fontWeight: 700 }}>{s.count} 次</span>
                <span style={{ flex: 1 }} />
                <span title={s.last_at} style={{ fontSize: 11.5, color: dim(0.45), whiteSpace: 'nowrap', fontFamily: MONO }}>
                  最近 {fmtRelative(s.last_at)}
                </span>
              </div>
              {projects.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {projects.map(([p, n]) => (
                    <span
                      key={p}
                      title={p}
                      style={{
                        fontSize: 10.5,
                        fontFamily: MONO,
                        padding: '2px 9px',
                        borderRadius: 999,
                        background: 'rgba(63,68,56,.05)',
                        color: dim(0.55),
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {baseOf(p)} × {n}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* 会话明细：该技能出现过的最近会话 */}
        {sessions !== null && sessions.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 8px' }}>
              <span style={{ fontWeight: 900, fontSize: 12.5, color: INK }}>会话</span>
              <span style={{ fontSize: 11, color: dim(0.4), fontFamily: MONO }}>{sessions.length} 个</span>
              <span style={{ flex: 1 }} />
              {sessions.length > 5 && (
                <span
                  onClick={() => {
                    store.setSkillDetail(null);
                    store.setView({ kind: 'usage', usageSkill: skill });
                  }}
                  style={{ fontSize: 11.5, color: PRIMARY, cursor: 'pointer', fontWeight: 700 }}
                >
                  在使用分析中查看全部 →
                </span>
              )}
            </div>
            {sessions.slice(0, 5).map((s) => {
              const agentName = store.snapshot?.agents.find((a) => a.id === s.agent)?.name ?? s.agent;
              const times = s.skills[skill] ?? s.count;
              return (
                <div
                  key={`${s.agent}-${s.session_id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '7px 12px',
                    border: '1px solid rgba(63,68,56,.07)',
                    borderRadius: 10,
                    marginBottom: 6,
                    fontSize: 12,
                  }}
                >
                  <AgentIcon agentId={s.agent} name={agentName} size={14} />
                  <span title={s.session_id} style={{ fontFamily: MONO, fontSize: 11, color: dim(0.55), whiteSpace: 'nowrap' }}>
                    {s.session_id.slice(0, 10)}…
                  </span>
                  {s.project_dir && (
                    <span
                      title={s.project_dir}
                      style={{
                        fontSize: 10.5,
                        fontFamily: MONO,
                        padding: '1px 8px',
                        borderRadius: 999,
                        background: 'rgba(63,68,56,.05)',
                        color: dim(0.55),
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {baseOf(s.project_dir)}
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: MONO, fontSize: 11.5, color: PRIMARY, fontWeight: 700 }}>{times} 次</span>
                  <span title={s.last_at} style={{ fontSize: 10.5, color: dim(0.4), fontFamily: MONO, whiteSpace: 'nowrap' }}>
                    {fmtRelative(s.last_at)}
                  </span>
                </div>
              );
            })}
          </>
        )}

        {/* 最近事件时间线 */}
        {events !== null && events.length > 0 && (
          <>
            <div style={{ fontWeight: 900, fontSize: 12.5, color: INK, margin: '16px 0 8px' }}>最近事件</div>
            {events.map((e) => {
              const agentName = store.snapshot?.agents.find((a) => a.id === e.agent)?.name ?? e.agent;
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 2px', fontSize: 12 }}>
                  <span title={e.occurred_at} style={{ fontFamily: MONO, fontSize: 11, color: dim(0.45), width: 92, flex: 'none' }}>
                    {fmtRelative(e.occurred_at)}
                  </span>
                  <span style={{ color: INK, fontWeight: 700, whiteSpace: 'nowrap' }}>{agentName}</span>
                  {e.project_dir && (
                    <span title={e.project_dir} style={{ fontSize: 10.5, fontFamily: MONO, color: dim(0.5), whiteSpace: 'nowrap' }}>
                      {baseOf(e.project_dir)}
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  {evidenceBadge(e.agent)}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

/** 采集覆盖的 Agent（与内核 probe 注册表一致） */
const PROBE_AGENTS = ['claude-code', 'opencode', 'codex', 'hermes', 'deepseek-harness'];

const panelStyle: CSSProperties = {
  border: '1px solid rgba(63,68,56,.09)',
  borderRadius: 13,
  background: '#ffffff',
  padding: '18px 20px',
};

/** 设置：使用采集开关（总开关 / 按 Agent / 立即扫描 / 清除数据） */
export function UsageCollectPanel(): ReactElement {
  const store = useStore();
  const settings = store.snapshot?.settings.usage_collection ?? { enabled: false, agents: {} };
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const save = (next: { enabled: boolean; agents: Record<string, boolean> }): void => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        await ripple.usageSettings(next);
        await store.refresh();
      } catch (err) {
        store.toast(`保存失败：${errText(err)}`);
      } finally {
        setBusy(false);
      }
    })();
  };

  const scanNow = (): void => {
    if (scanning) return;
    setScanning(true);
    void (async () => {
      try {
        const r = await ripple.usageScan();
        const failed = r.sources.filter((s) => s.error).length;
        store.toast(`扫描完成：新增 ${r.added} 条（${r.sources.length} 个源${failed ? `，${failed} 个失败` : ''}）`);
      } catch (err) {
        store.toast(`扫描失败：${errText(err)}`);
      } finally {
        setScanning(false);
      }
    })();
  };

  const clearAll = (): void => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    store.run(async () => {
      await ripple.usageClear();
      store.toast('已清除全部使用数据（事件 / 游标 / 聚合）');
    });
  };

  const agentToggle = (id: string): ReactElement => {
    const name = store.snapshot?.agents.find((a) => a.id === id)?.name ?? id;
    const on = settings.agents[id] !== false;
    return (
      <span
        key={id}
        className="rp-chip"
        onClick={() => save({ ...settings, agents: { ...settings.agents, [id]: !on } })}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          padding: '6px 12px',
          borderRadius: 999,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          border: `1px solid ${on ? 'rgba(107,127,67,.5)' : 'rgba(63,68,56,.12)'}`,
          background: on ? 'rgba(147,168,107,.1)' : undefined,
          color: on ? PRIMARY : dim(0.5),
          fontWeight: on ? 700 : undefined,
        }}
      >
        <AgentIcon agentId={id} name={name} size={14} />
        {on ? '✓ ' : ''}
        {name}
      </span>
    );
  };

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontWeight: 900, fontSize: 14, color: INK }}>使用分析（Skill 使用采集）</span>
        <span style={{ flex: 1 }} />
        <span
          className={settings.enabled ? 'rp-btn-outline' : 'rp-btn-grad'}
          onClick={() => save({ ...settings, enabled: !settings.enabled })}
          style={{
            ...(settings.enabled ? outlineBtn : gradBtn),
            fontSize: 12,
            padding: '6px 16px',
            opacity: busy ? 0.6 : undefined,
          }}
        >
          {settings.enabled ? '已开启 · 点击关闭' : '开启采集'}
        </span>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: dim(0.55), lineHeight: 1.7 }}>
        读取本机各 Agent 的会话记录提取技能调用元数据，仅保存技能名 / 时间 / 项目路径等统计信息，
        <b>不保存对话内容</b>，数据全部留在本地（~/.ripple/usage/）。默认关闭；开启后启动时与每 30
        分钟增量扫描一次。
      </p>
      {settings.enabled && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: dim(0.5), flex: 'none' }}>采集范围</span>
            {PROBE_AGENTS.map(agentToggle)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className="rp-btn-outline"
              onClick={scanNow}
              style={{ ...outlineBtn, fontSize: 12, padding: '6px 16px', opacity: scanning ? 0.6 : undefined }}
            >
              {scanning ? '扫描中…' : '立即扫描'}
            </span>
            <span
              className="rp-hover-danger"
              onClick={clearAll}
              style={{
                fontSize: 12,
                color: confirmClear ? DANGER : dim(0.45),
                fontWeight: confirmClear ? 700 : undefined,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {confirmClear ? '再次点击确认清除全部使用数据' : '清除数据'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
