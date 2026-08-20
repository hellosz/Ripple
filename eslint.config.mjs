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
      'test-results/**',
      'playwright-report/**',
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
