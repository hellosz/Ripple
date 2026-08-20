'use client';

import type { ReactElement } from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
}: SwitchProps): ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className="rp-switch"
      style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
      onClick={() => onChange(!checked)}
    >
      <span className="rp-switch-knob" />
    </button>
  );
}
