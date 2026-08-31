import type { ReactElement } from 'react';
import { ripple } from '../ripple-api.js';
import { useStore } from '../store.js';
import { PRIMARY, gradBtn } from '../ui.js';

/** electron-updater 下载完成后的顶部提示条 */
export function UpdateBanner(): ReactElement | null {
  const store = useStore();
  const { updaterVersion } = store;
  if (updaterVersion === null) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 20px',
        background: 'rgba(147,168,107,.14)',
        borderBottom: '1px solid rgba(107,127,67,.25)',
        fontSize: 12.5,
        color: PRIMARY,
        flex: 'none',
        animation: 'fade-in .25s ease-out',
      }}
    >
      <span style={{ fontWeight: 700 }}>
        新版本已就绪{updaterVersion ? ` · v${updaterVersion}` : ''}，重启应用即可完成更新
      </span>
      <span style={{ flex: 1 }} />
      <span
        className="rp-btn-grad"
        onClick={() => store.run(() => ripple.quitAndInstall())}
        style={{ ...gradBtn, fontSize: 12, padding: '5px 14px' }}
      >
        重启更新
      </span>
    </div>
  );
}
