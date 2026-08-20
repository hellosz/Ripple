import { copyText } from './format';

const DEEP_LINK_TIMEOUT_MS = 1500;

export interface InstallOptions {
  slug: string;
  command: string;
  /** 唤起失败（超时未离开页面）时回调：命令已复制 */
  onFallback: () => void;
}

/**
 * 安装入口：优先尝试 ripple:// Deep Link 唤起桌面客户端；
 * 1.5s 内页面未失焦则视为未安装客户端，回退复制 CLI 命令。
 */
export function installViaDeepLink({ slug, command, onFallback }: InstallOptions): void {
  if (typeof window === 'undefined') return;
  let left = false;
  const markLeft = () => {
    if (document.hidden) left = true;
  };
  const onBlur = () => {
    left = true;
  };
  document.addEventListener('visibilitychange', markLeft);
  window.addEventListener('blur', onBlur);

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = `ripple://install?skill=${encodeURIComponent(slug)}`;
  document.body.appendChild(iframe);

  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', markLeft);
    window.removeEventListener('blur', onBlur);
    iframe.remove();
    if (!left) {
      void copyText(command).then(() => onFallback());
    }
  }, DEEP_LINK_TIMEOUT_MS);
}
