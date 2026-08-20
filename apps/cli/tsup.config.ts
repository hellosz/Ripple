import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  target: 'node20',
  clean: true,
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire as __cliCreateRequire } from 'node:module';const require = __cliCreateRequire(import.meta.url);",
  },
  // 单文件产物：workspace 包与全部依赖一并打包
  noExternal: [/.*/],
  define: {
    __RIPPLE_CLI_VERSION__: JSON.stringify(pkg.version),
  },
});
