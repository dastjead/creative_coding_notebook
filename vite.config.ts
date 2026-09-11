import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Fieldnote — Creative Code Archive',
        short_name: 'Fieldnote',
        description: '모바일 크리에이티브 코딩 노트북',
        theme_color: '#f1eddf',
        background_color: '#f1eddf',
        display: 'standalone',
        start_url: base,
        scope: base,
        orientation: 'portrait-primary',
        icons: [
          { src: `${base}icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: `${base}icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/runner\.html/],
      },
    }),
  ],
  server: { cors: true },
  preview: { cors: true },
  build: {
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, 'index.html'),
        runner: resolve(import.meta.dirname, 'runner.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/p5')) return 'runner-p5';
          if (id.includes('node_modules/three')) return 'runner-three';
          if (id.includes('node_modules/@codemirror')) return 'editor';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
