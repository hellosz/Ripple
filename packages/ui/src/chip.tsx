'use client';

import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

/** 分类/筛选 chip */
export function Chip({ active = false, className = '', ...rest }: ChipProps): ReactElement {
  return (
    <button
      type="button"
      className={`rp-chip ${active ? 'rp-chip-active' : ''} ${className}`.trim()}
      {...rest}
    />
  );
}

export interface TagChipProps {
  children: ReactNode;
  tone?: 'solid' | 'soft';
  onClick?: () => void;
}

/** 卡片上的小标签（分类/来源） */
export function TagChip({ children, tone = 'solid', onClick }: TagChipProps): ReactElement {
  return (
    <span
      onClick={onClick}
      style={{
        fontSize: 11,
        padding: '3px 9px',
        borderRadius: 999,
        background: tone === 'solid' ? 'rgba(147,168,107,.14)' : 'rgba(147,168,107,.1)',
        color: 'var(--rp-primary)',
        whiteSpace: 'nowrap',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </span>
  );
}
