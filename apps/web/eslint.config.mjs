import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      globals: {
        Blob: 'readonly',
        File: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLAudioElement: 'readonly',
        KeyboardEvent: 'readonly',
        MediaRecorder: 'readonly',
        MediaStream: 'readonly',
        Node: 'readonly',
        PointerEvent: 'readonly',
        ResizeObserver: 'readonly',
        URL: 'readonly',
        clearTimeout: 'readonly',
        crypto: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        module: 'readonly',
        navigator: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        URLSearchParams: 'readonly',
        window: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        sourceType: 'module',
      },
    },
    plugins: {
      '@next/next': nextPlugin,
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
