import react from '@vitejs/plugin-react';

const isCI = process.env.GITHUB_ACTIONS === 'true';
// Em GitHub Pages o app fica em /kids-flashcards/
const base = isCI ? '/kids-flashcards/' : '/';

export default {
  base,
  plugins: [react()],
  root: './src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 5173,
  },
};
