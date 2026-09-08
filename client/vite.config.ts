import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [react(), tailwindcss()],
  server: {
    // The Discord Redirect URI is registered with an exact port. Falling back
    // to another port would silently break OAuth, so fail loudly instead.
    port: 5173,
    strictPort: true,
    // In development the SPA runs on Vite and the API on the server process.
    // In production the same Hono process serves both and there is no proxy.
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
});
