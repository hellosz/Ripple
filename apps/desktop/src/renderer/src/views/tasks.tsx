import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { SCENARIO_GROUPS } from '../components/scenario-panel.js';
import { ripple } from '../ripple-api.js';
import { errText, useStore } from '../store.js';
import { AMBER, DANGER, GREEN_DEEP, INK, MONO, PRIMARY, cardStyle, dim, gradBtn, outlineBtn } from '../ui.js';

/** 任务类型注册：后续新增批量任务在此追加条目 */
const TASK_TYPES: Array<{ key: string; name: string; desc: string }> = [
  {
    key: 'scenario',
    name: '场景分析',
    desc: '使用 AI 服务商为选中技能生成业务 / 岗位 / 场景 / 工具标签与概要，结果持久化本地。已分析过的技能可选择强制重新生成。',
  },
];

type ItemState = 'wait' | 'run' | 'ok' | 'fail';

interface RunItem {
  skill: string;
  state: ItemState;
  error?: string;
}

const stateLabel: Record<ItemState, { text: string; color: string }> = {
  wait: { text: '等待', color: 'rgba(75,80,64,.4)' },
  run: { text: '进行中…', color: PRIMARY },
  ok: { text: '完成', color: GREEN_DEEP },
  fail: { text: '失败', color: DANGER },
};

export function TasksView(): ReactElement {
  const store = useStore();
  const { snapshot } = store;
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  /** 当前会话：null=任务类型列表；'select'=选技能；'running'/'done' 由 items 状态推导 */
  const [selecting, setSelecting] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<RunItem[] | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    let alive = true;
    ripple
      .aiGetConfig()
      .then((c) => {
        if (alive) setAiReady(c.hasKey);
      })
      .catch(() => {
        if (alive) setAiReady(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!snapshot) {
    return <div style={{ textAlign: 'center', padding: '80px 0', color: dim(0.45) }}>加载中…</div>;
  }

  const allSkills = Object.keys(snapshot.skills).sort();
  const hasScenario = (skill: string): boolean => skill in snapshot.scenarios;

  const goAiSettings = (): void => {
    store.setView({ kind: 'settings' });
    store.setSettingsTab('ai');
  };

  const openSelect = (): void => {
    // 默认勾选未分析过的技能；已分析的可手动勾选（表示强制重新生成）
    const init: Record<string, boolean> = {};
    for (const s of allSkills) init[s] = !hasScenario(s);
    setChecked(init);
    setItems(null);
    setSelecting(true);
  };

  const selectedSkills = allSkills.filter((s) => checked[s]);

  const start = (): void => {
    if (selectedSkills.length === 0 || running) return;
    const plan: RunItem[] = selectedSkills.map((skill) => ({ skill, state: 'wait' }));
    setItems(plan);
    setSelecting(false);
    setRunning(true);
    abortRef.current = false;
    void (async () => {
      let ok = 0;
      let fail = 0;
      let aborted = false;
      for (const item of plan) {
        if (abortRef.current) {
          aborted = true;
          break;
        }
        setItems((list) =>
          (list ?? []).map((i) => (i.skill === item.skill ? { ...i, state: 'run' } : i)),
        );
        try {
          await ripple.aiScenario(item.skill, hasScenario(item.skill));
          ok++;
          setItems((list) =>
            (list ?? []).map((i) => (i.skill === item.skill ? { ...i, state: 'ok' } : i)),
          );
        } catch (err) {
          fail++;
          setItems((list) =>
            (list ?? []).map((i) =>
              i.skill === item.skill ? { ...i, state: 'fail', error: errText(err) } : i,
            ),
          );
        }
      }
      try {
        await ripple.logTask(
          '场景分析批量',
          `共 ${plan.length} 个 · 成功 ${ok} · 失败 ${fail}${aborted ? ' · 已中断' : ''}`,
        );
      } catch {
        /* 主日志失败不阻塞 */
      }
      await store.refresh();
      setRunning(false);
      store.toast(`场景分析任务${aborted ? '已中断' : '完成'}：成功 ${ok} · 失败 ${fail}`);
    })();
  };

  // ---- AI 未配置引导 ----
  if (aiReady === false) {
    return (
      <div style={{ textAlign: 'center', padding: '90px 0', color: dim(0.5) }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>任务需要 AI 服务商</div>
        <p style={{ margin: '10px auto 20px', fontSize: 12.5, lineHeight: 1.9, maxWidth: 380 }}>
          批量场景分析等任务依赖已配置的 AI 服务商（OpenAI / DeepSeek / 自定义），请先在设置中完成配置。
        </p>
        <span
          className="rp-btn-grad"
          onClick={goAiSettings}
          style={{ ...gradBtn, display: 'inline-block', fontSize: 12.5, padding: '8px 22px' }}
        >
          去设置 AI 服务商
        </span>
      </div>
    );
  }

  // ---- 执行 / 结果面板 ----
  if (items !== null) {
    const done = items.filter((i) => i.state === 'ok' || i.state === 'fail').length;
    const pct = items.length === 0 ? 0 : Math.round((done / items.length) * 100);
    return (
      <div style={{ maxWidth: 720 }}>
        <div style={{ ...cardStyle, padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 900, fontSize: 14.5, color: INK }}>场景分析批量任务</span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: dim(0.45) }}>
              {done}/{items.length}
            </span>
            <span style={{ flex: 1 }} />
            {running ? (
              <span
                className="rp-btn-outline"
                onClick={() => {
                  abortRef.current = true;
                }}
                style={{ ...outlineBtn, fontSize: 12, padding: '5px 14px', color: DANGER, borderColor: 'rgba(189,133,120,.4)' }}
              >
                停止（保留已完成）
              </span>
            ) : (
              <span
                className="rp-btn-outline"
                onClick={() => setItems(null)}
                style={{ ...outlineBtn, fontSize: 12, padding: '5px 14px' }}
              >
                返回任务列表
              </span>
            )}
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: 'rgba(63,68,56,.08)',
              margin: '14px 0 6px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                borderRadius: 999,
                background: 'linear-gradient(90deg,#93a86b,#b9c69a)',
                transition: 'width .3s ease',
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: dim(0.4), marginBottom: 10 }}>
            {running ? '顺序执行中，可随时停止（不回滚已完成项）' : '任务已结束，结果已写入操作记录'}
          </div>
          {items.map((i) => (
            <div
              key={i.skill}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 2px',
                borderTop: '1px dashed rgba(63,68,56,.07)',
                fontSize: 12.5,
              }}
            >
              <span style={{ fontFamily: MONO, fontWeight: 700, color: INK, whiteSpace: 'nowrap' }}>{i.skill}</span>
              {i.error !== undefined && (
                <span
                  title={i.error}
                  style={{
                    fontSize: 11,
                    color: DANGER,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {i.error}
                </span>
              )}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: stateLabel[i.state].color, whiteSpace: 'nowrap' }}>
                {i.state === 'run' && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      border: `2px solid ${PRIMARY}`,
                      borderTopColor: 'transparent',
                      marginRight: 5,
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                )}
                {stateLabel[i.state].text}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- 选择技能面板 ----
  if (selecting) {
    const setAll = (v: boolean): void => {
      const next: Record<string, boolean> = {};
      for (const s of allSkills) next[s] = v;
      setChecked(next);
    };
    const invert = (): void => {
      const next: Record<string, boolean> = {};
      for (const s of allSkills) next[s] = !checked[s];
      setChecked(next);
    };
    return (
      <div style={{ maxWidth: 720 }}>
        <div style={{ ...cardStyle, padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontWeight: 900, fontSize: 14.5, color: INK }}>选择要分析的技能</span>
            <span style={{ fontSize: 11.5, color: dim(0.45) }}>
              已选 {selectedSkills.length}/{allSkills.length}
            </span>
            <span style={{ flex: 1 }} />
            <span className="rp-chip" onClick={() => setAll(true)} style={{ fontSize: 11.5, color: PRIMARY, cursor: 'pointer', fontWeight: 700 }}>
              全选
            </span>
            <span className="rp-chip" onClick={invert} style={{ fontSize: 11.5, color: PRIMARY, cursor: 'pointer', fontWeight: 700 }}>
              反选
            </span>
            <span className="rp-chip" onClick={() => setAll(false)} style={{ fontSize: 11.5, color: dim(0.5), cursor: 'pointer', fontWeight: 700 }}>
              清空
            </span>
          </div>
          <div style={{ fontSize: 11, color: dim(0.4), marginBottom: 10 }}>
            默认勾选尚未分析的技能；勾选「已分析」的技能表示强制重新生成
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {allSkills.map((s) => (
              <label
                key={s}
                className="rp-hover-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 8px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 12.5,
                }}
              >
                <input
                  type="checkbox"
                  checked={!!checked[s]}
                  onChange={() => setChecked((c) => ({ ...c, [s]: !c[s] }))}
                  style={{ accentColor: PRIMARY }}
                />
                <span style={{ fontFamily: MONO, fontWeight: 700, color: INK, whiteSpace: 'nowrap' }}>{s}</span>
                {hasScenario(s) && (
                  <span
                    title={`已有场景分析（${SCENARIO_GROUPS.map((g) => snapshot.scenarios[s]?.tags[g.key][0]).filter(Boolean).join(' · ')}）；勾选后强制重新生成`}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 8px',
                      borderRadius: 999,
                      background: 'rgba(169,138,91,.12)',
                      color: AMBER,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    已分析
                  </span>
                )}
                <span style={{ flex: 1 }} />
                <span
                  style={{
                    fontSize: 11,
                    color: dim(0.4),
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 280,
                  }}
                >
                  {snapshot.skills[s]?.description ?? ''}
                </span>
              </label>
            ))}
            {allSkills.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: dim(0.4), fontSize: 12.5 }}>
                本地暂无技能
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
            <span
              className="rp-btn-outline"
              onClick={() => setSelecting(false)}
              style={{ ...outlineBtn, fontSize: 12.5, padding: '7px 16px' }}
            >
              取消
            </span>
            <span
              className="rp-btn-grad"
              onClick={start}
              style={{
                ...gradBtn,
                fontSize: 12.5,
                padding: '7px 18px',
                opacity: selectedSkills.length === 0 ? 0.5 : undefined,
              }}
            >
              开始分析 ({selectedSkills.length})
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ---- 任务类型列表 ----
  return (
    <div style={{ maxWidth: 720 }}>
      {TASK_TYPES.map((t) => (
        <div key={t.key} style={{ ...cardStyle, padding: '18px 22px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 900, fontSize: 14.5, color: INK }}>{t.name}</span>
            <span style={{ flex: 1 }} />
            <span
              className="rp-btn-grad"
              onClick={openSelect}
              style={{ ...gradBtn, fontSize: 12.5, padding: '7px 18px' }}
            >
              新建任务
            </span>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.8, color: dim(0.55), maxWidth: 560 }}>
            {t.desc}
          </p>
          <div style={{ fontSize: 11, color: dim(0.4), marginTop: 8, fontFamily: MONO }}>
            本地 {allSkills.length} 个技能 · 已分析 {allSkills.filter(hasScenario).length} 个
          </div>
        </div>
      ))}
      <div style={{ fontSize: 11.5, color: dim(0.35), padding: '4px 2px' }}>
        任务执行的主日志与每个技能的细分日志记录在「设置 → 操作记录」。
      </div>
    </div>
  );
}
