import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';

let commitSha = 'dev';
try {
  commitSha = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
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
  ]
});
