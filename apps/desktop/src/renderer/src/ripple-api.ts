import type { DesktopApi } from '../../shared/api.js';

declare global {
  interface Window {
    ripple: DesktopApi;
  }
}

export const ripple: DesktopApi = window.ripple;
