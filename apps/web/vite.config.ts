import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/v1': { target: 'http://127.0.0.1:3001', changeOrigin: true, timeout: 300_000, proxyTimeout: 300_000 },
      '/health': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/mcp': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/paid': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
        timeout: 180_000,
        proxyTimeout: 180_000,
      },
    },
  },
})
