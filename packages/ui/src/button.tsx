'use client';

import type { ButtonHTMLAttributes, ReactElement } from 'react';

export type ButtonVariant = 'primary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const SIZE_STYLES: Record<ButtonSize, { padding: string; fontSize: number; borderRadius: number }> =
  {
    sm: { padding: '6px 14px', fontSize: 12.5, borderRadius: 9 },
    md: { padding: '9px 22px', fontSize: 13, borderRadius: 10 },
    lg: { padding: '12px 36px', fontSize: 15, borderRadius: 12 },
  };

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  style,
  type = 'button',
  ...rest
}: ButtonProps): ReactElement {
  const s = SIZE_STYLES[size];
  return (
    <button
      type={type}
      className={`rp-btn rp-btn-${variant} ${className}`.trim()}
      style={{
        padding: s.padding,
        fontSize: s.fontSize,
        borderRadius: s.borderRadius,
        ...style,
      }}
      {...rest}
    />
  );
}
