import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

// 主进程/preload 全量打包（含 workspace 包与 electron-updater），
// 产物自包含：electron-builder 只需打 out/**，绕开 pnpm symlink 问题。
export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // usage-worker：ELECTRON_RUN_AS_NODE 子进程入口（扫描不进主进程，规避
        // node:sqlite / 原生 zstd 在 Electron 主进程的非确定性崩溃）
        input: { index: 'src/main/index.ts', 'usage-worker': 'src/main/usage-worker.ts' },
        external: ['electron'],
        output: { entryFileNames: '[name].js' },
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: 'src/preload/index.ts',
        external: ['electron'],
        output: {
          // sandbox:false + contextBridge：cjs 形态最稳
          format: 'cjs',
          entryFileNames: '[name].js',
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: { input: 'src/renderer/index.html' },
    },
  },
});
