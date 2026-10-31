import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'dist/**',
      'prod/**',
      'coverage/**',
      'static/**',
      'playwright-report/**',
      'test-results/**',
      '**/*.min.js',
    ],
  },
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  {
    files: ['**/*.{js,jsx,mjs}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        // Vitest globals (only matters if vitest.config sets globals: true)
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        beforeAll: 'readonly',
        afterEach: 'readonly',
        afterAll: 'readonly',
      },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Kept from the old .eslintrc.yml: these rules are in the new
      // recommended sets and the codebase intentionally relies on the pattern.
      'no-unused-vars': 'off',
      'no-useless-escape': 'off',
      'no-fallthrough': 'off',
      'react/prop-types': 'off',
      'react/display-name': 'off',
    },
  },
  prettier,
];
