import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

/** Parse public/_headers (the `/*` block) so `vite preview` serves the same security headers as production. */
function securityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const line of readFileSync('public/_headers', 'utf8').split('\n')) {
    const match = /^\s+([A-Za-z-]+):\s*(.+)$/.exec(line)
    if (match) headers[match[1]] = match[2].trim()
  }
  return headers
}

export default defineConfig({
  preview: { headers: securityHeaders() },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Calorie Tracker',
        short_name: 'Calories',
        description: 'Personal calorie and macro tracker',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#111111',
        theme_color: '#111111',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the barcode decoder WASM so scanning works offline.
        globPatterns: ['**/*.{js,css,html,png,svg,wasm}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
})
