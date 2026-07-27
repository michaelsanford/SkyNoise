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
        // Without an explicit id, app identity derives from start_url — so any
        // future change to `base` would orphan every existing installation
        // rather than updating it. Pinning it decouples identity from the path.
        id: '/SkyNoise/',
        name: 'SkyNoise Tracker',
        short_name: 'SkyNoise',
        description: 'Track overhead aircraft noise and arrivals/departures in real-time.',
        categories: ['travel', 'utilities', 'navigation'],
        theme_color: '#0b0f19',
        background_color: '#0b0f19',
        display: 'standalone',
        // Deliberately kept: the radar is a portrait-first layout. Worth
        // revisiting if a landscape layout is ever designed.
        orientation: 'portrait',
        // `shortcuts` deliberately omitted here: they would target #live /
        // #history, and nothing reads the hash yet, so every shortcut would
        // silently open the default tab. Added alongside hash routing.
        //
        // `screenshots` also omitted. They unlock Chrome's richer install UI, but
        // capturing them needs a real browser, and a fabricated screenshot in an
        // install prompt would misrepresent the app.
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            // Separate, padded asset. Previously the un-padded 512 served both
            // 'any' and 'maskable', which cannot be correct for both: Android's
            // adaptive-icon mask crops to roughly the central 80%, so the
            // un-padded artwork was being clipped on every install.
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
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
