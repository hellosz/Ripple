import type { CSSProperties, ReactElement } from 'react';

export interface AvatarProps {
  /** 显示名（取首字符） */
  name: string | null | undefined;
  size?: number;
  title?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

/** 字符头像（橄榄绿圆形） */
export function Avatar({ name, size = 32, title, style, onClick }: AvatarProps): ReactElement {
  const char = (name ?? '').trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      title={title ?? name ?? undefined}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'rgba(147,168,107,.2)',
        color: 'var(--rp-primary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(10, Math.round(size * 0.4)),
        fontWeight: 500,
        flex: 'none',
        border: '1px solid rgba(147,168,107,.35)',
        cursor: onClick ? 'pointer' : undefined,
        userSelect: 'none',
        ...style,
      }}
    >
      {char}
    </span>
  );
}
