import { defineConfig } from 'vite'

// base './' — сайт живёт в подпапке GitHub Pages; сборка кладётся в docs/, откуда Pages её раздаёт
export default defineConfig({
  base: './',
  build: { outDir: 'docs', emptyOutDir: true, chunkSizeWarningLimit: 900 },
})
