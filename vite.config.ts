import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

/** The Supabase origin allowed by the Content Security Policy, from VITE_SUPABASE_URL ('' when unset). */
function supabaseOrigin(url: string | undefined): string {
  if (!url?.trim()) return ''
  const parsed = new URL(url.trim())
  if (parsed.protocol !== 'https:') throw new Error('VITE_SUPABASE_URL must be an https:// URL')
  return parsed.origin
}

/** public/_headers with %SUPABASE_ORIGIN% filled in. */
function renderHeadersFile(origin: string): string {
  return readFileSync('public/_headers', 'utf8').replace(/ ?%SUPABASE_ORIGIN%/g, origin ? ` ${origin}` : '')
}

/** Parse the `/*` block so `vite preview` serves the same security headers as production. */
function securityHeaders(origin: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const line of renderHeadersFile(origin).split('\n')) {
    const match = /^\s+([A-Za-z-]+):\s*(.+)$/.exec(line)
    if (match) headers[match[1]] = match[2].trim()
  }
  return headers
}

/** Write the filled-in _headers into the build output (Cloudflare Pages reads it from there). */
function headersFile(origin: string): Plugin {
  let outDir = 'dist'
  return {
    name: 'security-headers-file',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    writeBundle() {
      writeFileSync(join(outDir, '_headers'), renderHeadersFile(origin))
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const origin = supabaseOrigin(env.VITE_SUPABASE_URL)
  return {
    preview: { headers: securityHeaders(origin) },
    plugins: [
      react(),
      headersFile(origin),
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
  }
})
