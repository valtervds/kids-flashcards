import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  root: './src',
  base: '/kids-flashcards/',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  // Gera sourcemaps em produção para facilitar depuração de erros apenas quando explicitamente habilitado
  sourcemap: true,
  // Permite desativar minificação via env flag VITE_DEBUG_BUILD=true (para mapear variáveis que causam TDZ em produção)
  minify: process.env.VITE_DEBUG_BUILD ? false : 'esbuild',
  },
  server: { port: 5173 },
}));
