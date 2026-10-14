import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@lxmn/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      '@lxmn/platform-desktop': fileURLToPath(new URL('./packages/platform-desktop/src/index.ts', import.meta.url)),
      '@lxmn/platform-mobile': fileURLToPath(new URL('./packages/platform-mobile/src/index.ts', import.meta.url)),
      '@lxmn/tokens': fileURLToPath(new URL('./packages/tokens/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
