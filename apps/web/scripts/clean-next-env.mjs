// Next 15.5 在 next-env.d.ts 里生成 `/// <reference path="./.next/types/routes.d.ts" />`，
// 触发根 ESLint 的 @typescript-eslint/triple-slash-reference（path: never）。
// 该文件是构建产物（已 gitignore），构建后移除该行，保证任意顺序执行 lint 都是绿的。
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'next-env.d.ts');
if (existsSync(file)) {
  const cleaned = readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => !line.includes('routes.d.ts'))
    .join('\n');
  writeFileSync(file, cleaned);
}
