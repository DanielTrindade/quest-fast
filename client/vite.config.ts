import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [react(), tailwindcss()],
  server: {
    // Not Vite's default 5173: another project on this machine holds it, and a
    // silent fallback to 5174 would break the Discord Redirect URI, which is
    // registered with an exact port. Fixed and strict, so it fails loudly.
    port: 5273,
    strictPort: true,
    // In development the SPA runs on Vite and the API on the server process.
    // In production the same Hono process serves both and there is no proxy.
    // Uploaded files are served by the server too, so /uploads goes with /api.
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
