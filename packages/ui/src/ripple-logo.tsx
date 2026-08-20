import type { ReactElement } from 'react';

export interface RippleLogoProps {
  size?: number;
  color?: string;
}

/** 涟漪 Logo（来自原型 Header 的 SVG） */
export function RippleLogo({ size = 30, color = '#6b7f43' }: RippleLogoProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="14" r="2.4" fill={color} />
      <path
        d="M16 22 A8 8 0 0 1 8 14"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity=".85"
      />
      <path
        d="M16 22 A8 8 0 0 0 24 14"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity=".85"
      />
      <path
        d="M16 26 A12 12 0 0 1 4 14"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity=".55"
      />
      <path
        d="M16 26 A12 12 0 0 0 28 14"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity=".55"
      />
    </svg>
  );
}
