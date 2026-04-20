import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import functional from 'eslint-plugin-functional'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', '**/coverage/**', '**/.worktrees/**'],
  },
  js.configs.recommended,
  // TypeScript ソースコード(src / test)— 型チェックあり
  {
    files: ['packages/*/src/**/*.ts', 'packages/*/test/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      functional,
    },
    rules: {
      // 関数型スタイルの徹底
      'no-var': 'error',
      'prefer-const': 'error',
      'no-param-reassign': 'error',
      'functional/no-let': 'error',
      'functional/no-loop-statements': 'error',

      // 未使用変数は _ プレフィックスで抑制
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // 型安全性
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/prefer-readonly': 'warn',

      // 型エイリアス(type)を interface より優先する方針
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    },
  },
  // 設定ファイル(tsup / vitest / eslint)— 型チェックなし、let/loop 許可
  {
    files: ['eslint.config.js', 'vitest.config.ts', 'packages/*/vitest.config.ts', 'packages/*/tsup.config.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
  },
  prettier,
)
