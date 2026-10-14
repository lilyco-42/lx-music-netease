import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@lxmn/tokens': fileURLToPath(new URL('../../packages/tokens/src/index.ts', import.meta.url)),
      '@lxmn/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@lxmn/platform-desktop': fileURLToPath(new URL('../../packages/platform-desktop/src/index.ts', import.meta.url)),
      '@lxmn/platform-mobile': fileURLToPath(new URL('../../packages/platform-mobile/src/index.ts', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome120',
  },
})
