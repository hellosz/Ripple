import type { CSSProperties, ReactElement } from 'react';
import { siClaudecode, siCursor, siDeepseek, siOpencode } from 'simple-icons';
import { glyphOf } from './ui.js';

/** simple-icons 官方矢量（构建期内联 path，无运行时外链） */
interface SvgBrand {
  path: string;
  hex: string;
}

/** 无官方图标的 Agent：品牌色圆角字母块兜底 */
interface LetterBrand {
  letter: string;
  hex: string;
}

const SVG_BRANDS: Record<string, SvgBrand> = {
  'claude-code': { path: siClaudecode.path, hex: `#${siClaudecode.hex}` },
  opencode: { path: siOpencode.path, hex: '#4b5040' },
  cursor: { path: siCursor.path, hex: '#3f4438' },
  'deepseek-harness': { path: siDeepseek.path, hex: `#${siDeepseek.hex}` },
};

const LETTER_BRANDS: Record<string, LetterBrand> = {
  // simple-icons v16 已无 OpenAI 图标（siOpenai 被移除），Codex 用字母块兜底
  codex: { letter: 'C', hex: '#10a37f' },
  // siHermes 是 Meta 的 Hermes JS 引擎，与 Agent 品牌无关，不复用
  hermes: { letter: 'H', hex: '#8b6bb0' },
  openclaw: { letter: '爪', hex: '#b0764b' },
  pi: { letter: 'π', hex: '#4b7fb0' },
};

export interface AgentIconProps {
  agentId: string;
  /** 兜底字母块取首字用（未知 Agent） */
  name: string;
  size?: number;
  /** 覆盖品牌色（如未安装态的置灰）；SVG 用作 fill，字母块用作底色 */
  color?: string;
}

/** Agent 品牌 logo：官方矢量优先，否则品牌色圆角字母块 */
export function AgentIcon({ agentId, name, size = 16, color }: AgentIconProps): ReactElement {
  const svg = SVG_BRANDS[agentId];
  if (svg) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{ display: 'block', flex: 'none' }}
        aria-hidden
      >
        <path d={svg.path} fill={color ?? svg.hex} />
      </svg>
    );
  }
  const brand = LETTER_BRANDS[agentId] ?? { letter: glyphOf(name), hex: '#7d8471' };
  const blockStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: Math.max(3, Math.round(size * 0.28)),
    background: color ?? brand.hex,
    color: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: Math.round(size * 0.62),
    fontWeight: 800,
    lineHeight: 1,
    flex: 'none',
    fontFamily: "'Noto Sans SC',system-ui,sans-serif",
    userSelect: 'none',
  };
  return (
    <span style={blockStyle} aria-hidden>
      {brand.letter}
    </span>
  );
}
