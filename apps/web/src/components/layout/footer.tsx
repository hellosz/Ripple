import type { ReactElement } from 'react';

export function Footer(): ReactElement {
  return (
    <footer
      style={{
        borderTop: '1px solid rgba(63,68,56,.06)',
        padding: '22px 32px',
        textAlign: 'center',
        fontSize: 12,
        color: 'rgba(75,80,64,.3)',
      }}
    >
      Ripple · One Drop, Endless Ripples.
    </footer>
  );
}
