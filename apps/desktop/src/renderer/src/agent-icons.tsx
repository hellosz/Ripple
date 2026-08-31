import type { CSSProperties, ReactElement } from 'react';
import { siClaudecode, siCursor, siDeepseek, siOpencode, siPi } from 'simple-icons';
import { HERMES_LOGO_B64 } from './hermes-logo.js';
import { INK, glyphOf } from './ui.js';

/** simple-icons / 官方站点实抓矢量（构建期内联 path，无运行时外链） */
interface SvgBrand {
  path: string;
  hex: string;
}

/** 无官方矢量的 Agent：品牌色圆角符号块兜底 */
interface LetterBrand {
  letter: string;
  hex: string;
}

/** OpenAI 六瓣花结单 path（官方资产，24×24），Codex 沿用 OpenAI 标识 */
const OPENAI_PATH =
  'M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z';

/** OpenClaw 官方龙虾（120×120，多元素），单色化主体色 */
const OPENCLAW = {
  hex: '#FF4D4D',
  body: 'M60 10 C30 10 15 35 15 55 C15 75 30 95 45 100 L45 110 L55 110 L55 100 C55 100 60 102 65 100 L65 110 L75 110 L75 100 C90 95 105 75 105 55 C105 35 90 10 60 10Z',
  leftClaw: 'M20 45 C5 40 0 50 5 60 C10 70 20 65 25 55 C28 48 25 45 20 45Z',
  rightClaw: 'M100 45 C115 40 120 50 115 60 C110 70 100 65 95 55 C92 48 95 45 100 45Z',
};

const SVG_BRANDS: Record<string, SvgBrand> = {
  'claude-code': { path: siClaudecode.path, hex: `#${siClaudecode.hex}` },
  // Codex 官方仅有 OpenAI 六瓣花结（单色），取主题墨色
  codex: { path: OPENAI_PATH, hex: INK },
  opencode: { path: siOpencode.path, hex: '#4b5040' },
  cursor: { path: siCursor.path, hex: '#3f4438' },
  'deepseek-harness': { path: siDeepseek.path, hex: `#${siDeepseek.hex}` },
  // pi.dev 官方图标（simple-icons 内置 siPi），单色取主题墨色
  pi: { path: siPi.path, hex: INK },
};

const LETTER_BRANDS: Record<string, LetterBrand> = {};

export interface AgentIconProps {
  agentId: string;
  /** 兜底字母块取首字用（未知 Agent） */
  name: string;
  size?: number;
  /** 覆盖品牌色（如未安装态的置灰）；SVG 用作 fill，字母块用作底色 */
  color?: string;
}

/** Agent 品牌 logo：官方矢量优先，否则品牌色圆角符号块 */
export function AgentIcon({ agentId, name, size = 16, color }: AgentIconProps): ReactElement {
  // Hermes：官方 PNG 内联（无矢量资产）；color 覆盖时（未安装置灰）转灰度降透明
  if (agentId === 'hermes') {
    return (
      <img
        src={`data:image/png;base64,${HERMES_LOGO_B64}`}
        width={size}
        height={size}
        alt=""
        aria-hidden
        style={{
          display: 'block',
          flex: 'none',
          borderRadius: Math.max(3, Math.round(size * 0.28)),
          objectFit: 'contain',
          ...(color ? { filter: 'grayscale(1)', opacity: 0.42 } : {}),
        }}
      />
    );
  }
  // OpenClaw：官方龙虾为多元素 SVG，走复合渲染分支
  if (agentId === 'openclaw') {
    const fill = color ?? OPENCLAW.hex;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        style={{ display: 'block', flex: 'none' }}
        aria-hidden
      >
        <path d={OPENCLAW.body} fill={fill} />
        <path d={OPENCLAW.leftClaw} fill={fill} />
        <path d={OPENCLAW.rightClaw} fill={fill} />
        {!color && (
          <>
            <circle cx="45" cy="35" r="6" fill="#050810" />
            <circle cx="75" cy="35" r="6" fill="#050810" />
          </>
        )}
      </svg>
    );
  }
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
    fontSize: Math.round(size * 0.72),
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
