import path from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : (process.env.BASE_PATH || '/'),
  plugins: [
    {
      name: 'development-only-csp',
      apply: 'serve',
      transformIndexHtml(html) {
        // Vite injects CSS and opens HMR sockets in development only.
        // The deployed HTML keeps the strict, Meta-only connect policy.
        return html.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
          .replace('connect-src https:', "connect-src 'self' ws: wss: https:");
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Social Watch', short_name: 'Social Watch',
        description: 'Private, on-device social moderation.',
        start_url: './', scope: './', display: 'standalone',
        background_color: '#f4f5f7', theme_color: '#354cdd',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        importScripts: ['notification-events.js'],
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        // Never cache Meta requests, tokens or API responses.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: [
      { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
      { find: /^react\/jsx-dev-runtime$/, replacement: 'preact/jsx-dev-runtime' },
      { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
      { find: /^react-dom$/, replacement: 'preact/compat' },
      { find: /^react$/, replacement: 'preact/compat' },
      { find: '@', replacement: path.resolve(import.meta.dirname, 'src') },
    ],
  },
  root: import.meta.dirname,
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: { outDir: 'dist/public', emptyOutDir: true },
  server: { port: Number(process.env.PORT || 5173), host: '0.0.0.0', strictPort: true, allowedHosts: true },
  preview: { port: Number(process.env.PORT || 5173), host: '0.0.0.0', allowedHosts: true },
}));
