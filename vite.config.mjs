import react from '@vitejs/plugin-react';

const isCI = process.env.GITHUB_ACTIONS === 'true';
// Em GitHub Pages o app fica em /kids-flashcards/
const base = '/kids-flashcards/';

export default {
  base,
  plugins: [react()],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: process.env.VITE_DEBUG_BUILD ? false : 'esbuild'
  },
  server: {
    port: 5173,
  },
};
