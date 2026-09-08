import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [react(), tailwindcss()],
  server: {
    // Em desenvolvimento o SPA roda no Vite e a API no processo do server.
    // Em produção o mesmo processo Hono serve os dois e não há proxy.
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
});
