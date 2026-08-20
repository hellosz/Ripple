import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@ripple/hub', '@ripple/api-client', '@ripple/contract', '@ripple/skill-core'] })],
    build: {
      rollupOptions: { input: 'src/main/index.ts' },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: 'src/preload/index.ts' },
    },
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: { input: 'src/renderer/index.html' },
    },
  },
});
