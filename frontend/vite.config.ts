import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Manifest colors cannot read CSS variables; keep them in sync with styles/tokens.css
// (--color-primary and --color-bg) when the real design lands.
const THEME_COLOR = '#c8643c'
const BACKGROUND_COLOR = '#faf6f0'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
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
        // Placeholder icons: replace the files in public/icons with the real logo.
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
