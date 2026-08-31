import { useEffect, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { UsageStatEntry } from '@ripple/hub';
import { AgentIcon } from '../agent-icons.js';
import { ripple } from '../ripple-api.js';
import { errText, useStore } from '../store.js';
import { AMBER, DANGER, GREEN_DEEP, INK, MONO, PRIMARY, dim, fmtRelative, gradBtn, outlineBtn } from '../ui.js';

/** 证据等级标注：codex 为路径启发式，其余 probe 为结构化工具调用 */
export function evidenceBadge(agent: string): ReactElement {
  const heuristic = agent === 'codex';
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    ripple
      .usageStats(skill)
      .then((s) => {
        if (alive) setStats(s);
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
        <span style={{ flex: 1 }} />
        <span
          className="rp-btn-outline"
          onClick={() => {
            setStats(null);
            void ripple
              .usageScan()
              .then(async (r) => {
                store.toast(`扫描完成：新增 ${r.added} 条`);
                setStats(await ripple.usageStats(skill));
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
      </div>
    </div>
  );
}

/** 采集覆盖的 Agent（与内核 probe 注册表一致） */
const PROBE_AGENTS = ['claude-code', 'opencode', 'codex'];

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
