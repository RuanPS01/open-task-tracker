import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['scripts/**/*.mjs', 'packages/**/*.ts', 'apps/web/pwa/**/*.ts', 'apps/web/vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // Modelo do service worker: __VERSION__ e __PRECACHE__ são trocados no build.
    files: ['apps/web/pwa/service-worker.js'],
    languageOptions: { globals: { ...globals.serviceworker, __VERSION__: 'readonly', __PRECACHE__: 'readonly' } },
  },
);
