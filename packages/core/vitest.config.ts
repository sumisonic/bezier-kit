import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    include: ['test/**/*.spec.ts'],
    typecheck: {
      enabled: true,
      include: ['test/**/*.spec-d.ts'],
    },
    benchmark: {
      include: ['test/**/*.bench.ts'],
    },
  },
})
