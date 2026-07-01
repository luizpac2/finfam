import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    // O worker do pdf.js é naturalmente grande; evitamos avisos ruidosos.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        /**
         * Code splitting por dependência: cada biblioteca pesada vira um chunk
         * próprio, com hash de conteúdo, para cache de longo prazo e para não
         * inflar o bundle inicial.
         *
         * - `recharts` e `pdfjs-dist` só são baixados quando realmente usados
         *   (Dashboard e importação de PDF, ambos via lazy/dynamic import).
         */
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          charts: ['recharts'],
          pdf: ['pdfjs-dist'],
        },
      },
    },
  },
});
