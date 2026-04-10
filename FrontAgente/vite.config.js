import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const basePath = env.VITE_GH_PAGES_BASE || '/';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['icons/apple-touch-icon.png'],
        manifest: {
          name: 'PilotoAgente',
          short_name: 'PilotoAgente',
          description: 'Control operativo de caja, scanner y clientes.',
          theme_color: '#0f172a',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: basePath,
          start_url: basePath,
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          navigateFallback: 'index.html'
        }
      })
    ],
    base: basePath,
    server: {
      port: 5173
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/tests/setup.js',
      globals: true
    }
  };
});
