import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    // Proxy /api/* to the backend.
    // Both services use network_mode: host, so backend is always reachable at localhost:3001.
    // VITE_PROXY_TARGET defaults to http://localhost:3001 (set in docker-compose.dev.yml).
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0', 'backend', 'sweeping-manually-grouse.ngrok-free.app']
  },
  define: {
    // Make env vars available — only VITE_ prefixed vars are exposed
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
});
