import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Site estático: a web fala direto com o Firebase (ou usa o lowdb no navegador).
// VITE_BASE_PATH define o subcaminho de publicação; no GitHub Pages de projeto é
// /nome-do-repositorio/ (o workflow preenche sozinho).
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  // As variáveis VITE_* (Firebase, modo de dados) ficam no .env da raiz do repositório.
  envDir: '../..',
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
