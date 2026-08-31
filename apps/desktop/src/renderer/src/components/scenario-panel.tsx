import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { ScenarioAnalysis } from '@ripple/hub';
import { ripple } from '../ripple-api.js';
import { errText, useStore } from '../store.js';
import { AMBER, GREEN_DEEP, INK, MONO, PRIMARY, REPO_BLUE, dim, fmtTime, gradBtn, outlineBtn } from '../ui.js';

export const SCENARIO_GROUPS: Array<{ key: keyof ScenarioAnalysis['tags']; name: string; color: string }> = [
  { key: 'business', name: '业务', color: REPO_BLUE },
  { key: 'role', name: '岗位', color: PRIMARY },
  { key: 'scene', name: '场景', color: GREEN_DEEP },
  { key: 'tool', name: '工具', color: AMBER },
];

type ScenarioResult = ScenarioAnalysis & { stale?: boolean };

/** 应用场景分析面板：标签四类 + 概要；结果本地持久化，内容指纹变化提示重新生成 */
export function ScenarioPanel({
  skill,
  onGoAiSettings,
  onTagClick,
}: {
  skill: string;
  onGoAiSettings: () => void;
  /** 点击标签（快捷搜索同标签技能） */
  onTagClick?: (tag: string) => void;
}): ReactElement {
  const store = useStore();
  const cached = store.snapshot?.scenarios[skill] ?? null;
  const [result, setResult] = useState<ScenarioResult | null>(cached);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 有缓存时静默读取一次以获知 stale（命中缓存不调用 LLM）
  useEffect(() => {
    let alive = true;
    setResult(cached);
    setError(null);
    if (cached) {
      ripple
        .aiScenario(skill)
        .then((r) => {
          if (alive) setResult(r);
        })
        .catch(() => {
          /* 读取缓存失败时保留 snapshot 中的结果 */
        });
    }
    return () => {
      alive = false;
    };
    // 换技能时重置（cached 由 skill 派生，不作为依赖以避免快照刷新反复触发）
  }, [skill]);

  const generate = (force: boolean): void => {
    if (busy) return;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        setResult(await ripple.aiScenario(skill, force));
        await store.refresh();
        store.toast('场景分析已生成并保存本地');
      } catch (err) {
        setError(errText(err));
      } finally {
        setBusy(false);
      }
    })();
  };

  if (result === null) {
    return (
      <div style={{ textAlign: 'center', padding: '90px 0', color: dim(0.5) }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>应用场景分析</div>
        <p style={{ margin: '10px auto 20px', fontSize: 12.5, lineHeight: 1.9, maxWidth: 380 }}>
          使用已配置的 AI 服务商分析该技能的适用业务、岗位、场景与工具，生成标签与概要，
          结果持久化在本地，重启后无需重复生成。
        </p>
        {busy ? (
          <div style={{ fontSize: 13, color: dim(0.45) }}>
            分析中…
            <div style={{ fontSize: 11.5, marginTop: 8, color: dim(0.35) }}>正在阅读技能内容并归纳应用场景</div>
          </div>
        ) : (
          <span
            className="rp-btn-grad"
            onClick={() => generate(false)}
            style={{ ...gradBtn, display: 'inline-block', fontSize: 12.5, padding: '8px 22px' }}
          >
            生成场景分析
          </span>
        )}
        {error !== null && (
          <div style={{ marginTop: 18, fontSize: 12.5, color: '#bd8578' }}>
            {error}
            <div style={{ marginTop: 10 }}>
              <span
                className="rp-btn-outline"
                onClick={onGoAiSettings}
                style={{ ...outlineBtn, display: 'inline-block', fontSize: 12, padding: '6px 16px' }}
              >
                去设置 AI 服务商
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingRight: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontWeight: 900, fontSize: 13.5, color: INK }}>应用场景分析</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: dim(0.4), whiteSpace: 'nowrap' }}>
          生成于 {fmtTime(result.at, true)}
        </span>
        <span style={{ flex: 1 }} />
        <span
          className="rp-btn-outline"
          onClick={() => generate(true)}
          style={{ ...outlineBtn, fontSize: 11.5, padding: '4px 13px', flex: 'none', opacity: busy ? 0.5 : undefined }}
        >
          {busy ? '重新分析中…' : '重新生成'}
        </span>
      </div>

      {result.stale === true && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid rgba(169,138,91,.35)',
            background: 'rgba(169,138,91,.07)',
            borderRadius: 10,
            padding: '8px 14px',
            margin: '10px 0 4px',
            fontSize: 12,
            color: AMBER,
          }}
        >
          ⚠ 技能内容在分析后发生了变化，建议重新生成以反映当前内容
        </div>
      )}

      {error !== null && (
        <div style={{ margin: '10px 0 4px', fontSize: 12, color: '#bd8578' }}>{error}</div>
      )}

      <div
        style={{
          border: '1px solid rgba(63,68,56,.1)',
          borderRadius: 12,
          padding: '14px 18px',
          margin: '12px 0',
          fontSize: 13,
          lineHeight: 1.85,
          color: INK,
          background: 'rgba(147,168,107,.05)',
          userSelect: 'text',
        }}
      >
        {result.summary}
      </div>

      {SCENARIO_GROUPS.map((g) => {
        const tags = result.tags[g.key];
        if (tags.length === 0) return null;
        return (
          <div key={g.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
            <span
              style={{
                width: 44,
                flex: 'none',
                fontSize: 12,
                fontWeight: 800,
                color: g.color,
                paddingTop: 3,
              }}
            >
              {g.name}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, minWidth: 0 }}>
              {tags.map((t) => (
                <span
                  key={t}
                  className={onTagClick ? 'rp-chip' : undefined}
                  title={onTagClick ? '点击筛选同标签技能' : undefined}
                  onClick={onTagClick ? () => onTagClick(t) : undefined}
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '3px 12px',
                    borderRadius: 999,
                    background: `${g.color}1c`,
                    color: g.color,
                    whiteSpace: 'nowrap',
                    cursor: onTagClick ? 'pointer' : undefined,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ fontFamily: MONO, fontSize: 10.5, color: dim(0.35), marginTop: 14 }}>
        指纹 {result.fingerprint.slice(0, 12)} · 结果保存于本地，卸载技能时自动清理
      </div>
    </div>
  );
}
