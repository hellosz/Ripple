import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

// 主进程/preload 全量打包（含 workspace 包与 electron-updater），
// 产物自包含：electron-builder 只需打 out/**，绕开 pnpm symlink 问题。
export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: 'src/main/index.ts',
        external: ['electron'],
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
