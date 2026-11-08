import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // host: true lets phones/tablets on your Wi-Fi open the dev server (Vite prints a "Network" URL)
  server: { host: true, port: 5173, proxy: { '/api': 'http://localhost:4000' } },
  preview: { host: true, port: 4173, proxy: { '/api': 'http://localhost:4000' } },
});