import react from '@vitejs/plugin-react';

export default {
  plugins: [react()],
  root: './src',
  publicDir: '../public', // assets PWA (manifest, sw, icons)
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 5173,
  },
};
