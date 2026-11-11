import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Manifest colors cannot read CSS variables; keep them in sync with styles/tokens.css
// (--color-primary and --color-bg).
const THEME_COLOR = '#2460f0'
const BACKGROUND_COLOR = '#eaf4ff'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'carrie/*.webp', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Carrie',
        short_name: 'Carrie',
        description: 'Carrie carries the conversation between an elder, their family and their doctor.',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5240,
    strictPort: true,
    proxy: { '/api': 'http://localhost:3050' },
  },
})
