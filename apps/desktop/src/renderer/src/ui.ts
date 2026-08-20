import type { CSSProperties } from 'react';

// ---- 设计 token（对应原型橄榄绿体系） ----
export const INK = '#3f4438';
export const PRIMARY = '#6b7f43';
export const SOFT = '#93a86b';
export const GREEN = '#7fa588';
export const GREEN_DEEP = '#6d8f76';
export const AMBER = '#a98a5b';
export const DANGER = '#bd8578';
export const GRAD = 'linear-gradient(135deg,#93a86b,#b9c69a)';
export const MONO = "'Space Grotesk',ui-monospace,monospace";
export const SANS = "'Noto Sans SC',system-ui,sans-serif";
/** 侧边栏 / 弹窗头图（原型为照片，构建内无外部图片，用同色系渐变替代） */
export const HERO_BG = 'linear-gradient(160deg,#55663a 0%,#3a4632 55%,#262e26 100%)';

export const dim = (a: number): string => `rgba(75,80,64,${a})`;
export const line = (a: number): string => `rgba(63,68,56,${a})`;

/** 范围 / tab 圆角 chip */
export const chipStyle = (active: boolean): CSSProperties => ({
  fontSize: 12,
  padding: '6px 14px',
  borderRadius: 999,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  border: `1px solid ${active ? 'rgba(107,127,67,.5)' : 'rgba(63,68,56,.12)'}`,
  background: active ? 'rgba(147,168,107,.1)' : undefined,
  color: active ? PRIMARY : dim(0.6),
  fontWeight: active ? 700 : undefined,
});

/** 技能首字图标 */
export const iconBox: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: 'rgba(147,168,107,.1)',
  color: PRIMARY,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  fontWeight: 900,
  flex: 'none',
};

/** 渐变主按钮 */
export const gradBtn: CSSProperties = {
  background: GRAD,
  color: '#ffffff',
  fontWeight: 700,
  borderRadius: 8,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

/** 描边次按钮 */
export const outlineBtn: CSSProperties = {
  border: '1px solid rgba(107,127,67,.4)',
  color: PRIMARY,
  fontWeight: 700,
  borderRadius: 8,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export const cardStyle: CSSProperties = {
  border: '1px solid rgba(63,68,56,.08)',
  borderRadius: 13,
  background: '#ffffff',
};

export const inputStyle: CSSProperties = {
  border: '1px solid rgba(63,68,56,.14)',
  borderRadius: 8,
  padding: '8px 11px',
  fontSize: 12.5,
  outline: 'none',
  background: '#faf9f2',
  color: INK,
  fontFamily: MONO,
};

export function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

const pad = (x: number): string => String(x).padStart(2, '0');

/** ISO → "MM-DD HH:mm"（withYear 时带年份） */
export function fmtTime(iso: string, withYear = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const md = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return withYear ? `${d.getFullYear()}-${md}` : md;
}

export function fmtClock(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function glyphOf(name: string): string {
  const ch = name.trim().charAt(0);
  return ch ? ch.toUpperCase() : '?';
}

export function fmtCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p.replace(/\/$/, '') : p.replace(/^\/|\/$/g, '')))
    .join('/');
}
