import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    base: env.VITE_GH_PAGES_BASE || '/',
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
