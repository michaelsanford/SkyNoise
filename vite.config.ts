// vitest/config re-exports Vite's defineConfig with the `test` key typed.
// Importing from 'vite' instead makes `test:` a type error.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';

let commitSha = 'dev';
try {
  commitSha = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  // Fallback if git is not installed or repo is detached
}
if (process.env.VITE_COMMIT_SHA) {
  commitSha = process.env.VITE_COMMIT_SHA;
}

// https://vite.dev/config/
export default defineConfig({
  base: '/SkyNoise/',
  define: {
    __COMMIT_SHA__: JSON.stringify(commitSha),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      workbox: {
        // Workbox's default globPatterns omit woff2. Without this the
        // self-hosted font is not precached and falls back to a system font
        // once offline.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      },
      manifest: {
        name: 'SkyNoise Tracker',
        short_name: 'SkyNoise',
        description: 'Track overhead aircraft noise and arrivals/departures in real-time.',
        theme_color: '#0b0f19',
        background_color: '#0b0f19',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  test: {
    // App.tsx needs a DOM. The utils tests do not, but a single environment
    // keeps the config honest — jsdom is a superset for our purposes.
    environment: 'jsdom',
    // globals: false — tests import { describe, it, expect } explicitly, which
    // is the existing convention in geo.test.ts and noise.test.ts.
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    // `virtual:pwa-register/react` is synthesised by vite-plugin-pwa at build
    // time and cannot resolve under Vitest. Scoped to `test.alias` so the
    // production build still gets the real implementation.
    alias: {
      'virtual:pwa-register/react': new URL(
        './src/test/mocks/pwa-register.ts',
        import.meta.url
      ).pathname
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts', 'src/main.tsx']
      // No thresholds yet: a number picked against a near-zero baseline either
      // fails the build or means nothing. Measure first, then ratchet.
    }
  }
});
