import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/out/**',
      '**/coverage/**',
      // 旧栈（过渡期，不纳入新 lint 基线）
      'frontend/**',
      'cli/**',
      'backend/**',
      'skills/**',
      'tmp/**',
      // 旧 e2e 视觉断言（任务 4.13 迁移到新 UI 后移除此行）
      'e2e/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    ...tseslint.configs.disableTypeChecked,
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' },
    },
  },
);
