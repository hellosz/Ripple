import { useMemo, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { diffLines } from 'diff';
import type { AiScoreResult, AiSuggestResult, Rating } from '@ripple/contract';
import { AMBER, DANGER, GREEN_DEEP, INK, MONO, PRIMARY, dim, outlineBtn } from '../ui.js';

// ---- 评级色系（S/A/B/C 对应橄榄绿体系） ----
export const GRADE_COLORS: Record<Rating, string> = {
  S: PRIMARY,
  A: GREEN_DEEP,
  B: AMBER,
  C: DANGER,
};

/** 维度分数条颜色：<40 红调、<55 琥珀、其余橄榄绿 */
const barColor = (score: number): string => (score < 40 ? DANGER : score < 55 ? AMBER : PRIMARY);

const fallbackNote: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  padding: '2px 9px',
  borderRadius: 999,
  background: 'rgba(169,138,91,.12)',
  color: AMBER,
  whiteSpace: 'nowrap',
};

// ================= 评分卡 =================

export function ScoreCard({
  result,
  onRescore,
  scoring,
}: {
  result: AiScoreResult;
  onRescore: () => void;
  scoring: boolean;
}): ReactElement {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const gradeColor = GRADE_COLORS[result.grade];

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingRight: 4 }}>
      {/* 总分 + 等级 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 46, fontWeight: 700, color: gradeColor, lineHeight: 1 }}>
          {result.total}
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 15,
            fontWeight: 800,
            width: 34,
            height: 34,
            borderRadius: 10,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${gradeColor}1f`,
            color: gradeColor,
            flex: 'none',
          }}
        >
          {result.grade}
        </span>
        {result.source === 'fallback' && <span style={fallbackNote}>规则评分（未配置 AI）</span>}
        <span style={{ flex: 1 }} />
        <span
          className="rp-btn-outline"
          onClick={onRescore}
          style={{ ...outlineBtn, fontSize: 11.5, padding: '5px 14px', flex: 'none', opacity: scoring ? 0.5 : undefined }}
        >
          {scoring ? '评分中…' : '重新评分'}
        </span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 12.5, color: dim(0.6), lineHeight: 1.7 }}>{result.summary}</p>

      {/* 6 维度条（点击展开理由） */}
      {result.dimensions.map((d) => {
        const on = !!open[d.key];
        return (
          <div
            key={d.key}
            onClick={() => setOpen((m) => ({ ...m, [d.key]: !m[d.key] }))}
            style={{
              padding: '9px 12px',
              borderRadius: 10,
              cursor: 'pointer',
              background: on ? 'rgba(147,168,107,.07)' : undefined,
              marginBottom: 2,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 88, fontSize: 12.5, fontWeight: 700, color: INK, flex: 'none' }}>{d.name}</span>
              <div
                style={{
                  flex: 1,
                  height: 7,
                  borderRadius: 999,
                  background: 'rgba(63,68,56,.08)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${d.score}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: barColor(d.score),
                    transition: 'width .4s ease-out',
                  }}
                />
              </div>
              <span
                style={{
                  width: 32,
                  textAlign: 'right',
                  fontFamily: MONO,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: barColor(d.score),
                  flex: 'none',
                }}
              >
                {d.score}
              </span>
              <span style={{ fontSize: 10, color: dim(0.35), flex: 'none', width: 12 }}>{on ? '▾' : '▸'}</span>
            </div>
            {on && (
              <p style={{ margin: '7px 0 0', fontSize: 12, color: dim(0.55), lineHeight: 1.7 }}>{d.reason}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ================= 建议清单 =================

const SUGGEST_GROUPS: Array<{ type: 'business' | 'technical'; name: string }> = [
  { type: 'business', name: '业务建议' },
  { type: 'technical', name: '技术建议' },
];

export function SuggestList({ result }: { result: AiSuggestResult }): ReactElement {
  return (
    <>
      {SUGGEST_GROUPS.map((g) => {
        const items = result.suggestions.filter((s) => s.type === g.type);
        if (items.length === 0) return null;
        return (
          <div key={g.type} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: dim(0.45), letterSpacing: 1, marginBottom: 6 }}>
              {g.name}
            </div>
            {items.map((s, i) => (
              <div
                key={`${g.type}-${i}`}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: 'rgba(63,68,56,.03)',
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{s.title}</div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: dim(0.55), lineHeight: 1.7 }}>{s.detail}</p>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

// ================= git 风格 diff =================

/** 与 file-viewer 一致的橄榄调深色代码底 */
const CODE_BG = '#23271f';
const CODE_CTX = 'rgba(216,219,201,.5)';

type DiffRow =
  | { kind: 'add' | 'del' | 'ctx'; text: string }
  | { kind: 'fold'; count: number };

/** value（含结尾换行）拆行：去掉末尾换行产生的空行 */
const splitLines = (value: string): string[] => {
  const lines = value.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
};

/** 行级 diff → 渲染行；连续未变 >6 行折叠为「… N 行未变 …」（保留前后各 3 行上下文） */
export function buildDiffRows(oldText: string, newText: string): DiffRow[] {
  const rows: DiffRow[] = [];
  // 新文件（当前内容为空）：全部按新增渲染，避免 diff 产生空删除行
  if (oldText === '') {
    for (const l of splitLines(newText)) rows.push({ kind: 'add', text: l });
    return rows;
  }
  for (const c of diffLines(oldText, newText)) {
    const kind: DiffRow['kind'] = c.added ? 'add' : c.removed ? 'del' : 'ctx';
    const lines = splitLines(c.value);
    if (kind === 'ctx' && lines.length > 6) {
      for (const l of lines.slice(0, 3)) rows.push({ kind, text: l });
      rows.push({ kind: 'fold', count: lines.length - 6 });
      for (const l of lines.slice(-3)) rows.push({ kind, text: l });
    } else {
      for (const l of lines) rows.push({ kind, text: l });
    }
  }
  return rows;
}

const DIFF_ROW_STYLES: Record<'add' | 'del' | 'ctx', CSSProperties> = {
  add: { background: 'rgba(147,168,107,.18)', color: '#cfe0b4' },
  del: { background: 'rgba(189,133,120,.18)', color: '#e3b7aa' },
  ctx: { color: CODE_CTX },
};

const DIFF_PREFIX: Record<'add' | 'del' | 'ctx', string> = { add: '+', del: '-', ctx: ' ' };

export function DiffBlock({ oldText, newText }: { oldText: string; newText: string }): ReactElement {
  const rows = useMemo(() => buildDiffRows(oldText, newText), [oldText, newText]);
  return (
    <div
      style={{
        background: CODE_BG,
        borderRadius: 10,
        maxHeight: 320,
        overflow: 'auto',
        padding: '8px 0',
      }}
    >
      {rows.map((r, i) =>
        r.kind === 'fold' ? (
          <div
            key={i}
            style={{
              fontFamily: MONO,
              fontSize: 11.5,
              lineHeight: 1.7,
              color: 'rgba(216,219,201,.32)',
              textAlign: 'center',
              padding: '2px 14px',
              userSelect: 'none',
            }}
          >
            ⋯ {r.count} 行未变 ⋯
          </div>
        ) : (
          <div
            key={i}
            style={{
              fontFamily: MONO,
              fontSize: 12,
              lineHeight: 1.7,
              whiteSpace: 'pre',
              padding: '0 14px',
              minWidth: 'fit-content',
              ...DIFF_ROW_STYLES[r.kind],
            }}
          >
            {DIFF_PREFIX[r.kind]} {r.text}
          </div>
        ),
      )}
      {rows.length === 0 && (
        <div style={{ fontFamily: MONO, fontSize: 12, color: CODE_CTX, padding: '2px 14px' }}>（内容无变化）</div>
      )}
    </div>
  );
}
