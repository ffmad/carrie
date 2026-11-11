import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Manifest colors cannot read CSS variables; keep them in sync with styles/tokens.css
// (--color-primary and --color-bg).
const THEME_COLOR = '#2460f0'
const BACKGROUND_COLOR = '#eaf4ff'

// From another device (a phone on the tailnet), the page can only reach this machine through
// its own address, so the dev server also forwards the database and file storage.
const supabaseUrl = loadEnv('development', '.', 'VITE_').VITE_SUPABASE_URL

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
    // IPv4 on purpose: `tailscale serve` forwards to 127.0.0.1, and a bare "localhost" can end up IPv6-only.
    host: '127.0.0.1',
    port: 5240,
    strictPort: true,
    // `tailscale serve` reaches the dev server under the machine's tailnet name.
    allowedHosts: ['.ts.net'],
    proxy: {
      '/api': 'http://localhost:3050',
      ...(supabaseUrl && {
        '/supabase': { target: supabaseUrl, changeOrigin: true, rewrite: (path: string) => path.replace(/^\/supabase/, '') },
      }),
    },
  },
})
