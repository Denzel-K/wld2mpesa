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
    // VITE_PROXY_TARGET is set to http://backend:3001 in Docker dev (docker-compose.dev.yml)
    // so the proxy uses the Docker service name instead of localhost.
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
