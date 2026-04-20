import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    include: ['packages/*/test/**/*.{spec,test,bench,spec-d}.ts'],
    typecheck: {
      enabled: false,
      include: ['packages/*/test/**/*.spec-d.ts'],
    },
  },
})
