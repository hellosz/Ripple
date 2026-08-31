'use client';

import type { HTMLAttributes, ReactElement } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padding?: string | number;
}

export function Card({
  hoverable = false,
  padding = '22px 24px',
  className = '',
  style,
  ...rest
}: CardProps): ReactElement {
  return (
    <div
      className={`rp-card ${hoverable ? 'rp-card-hover' : ''} ${className}`.trim()}
      style={{ padding, ...style }}
      {...rest}
    />
  );
}
