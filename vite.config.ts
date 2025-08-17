import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  root: './src',
  base: '/kids-flashcards/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: { port: 5173 },
}));
