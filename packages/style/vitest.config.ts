import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    include: ['test/**/*.{spec,test,bench,spec-d}.ts'],
    typecheck: {
      enabled: false,
      include: ['test/**/*.spec-d.ts'],
    },
    benchmark: {
      include: ['test/**/*.bench.ts'],
    },
  },
})
