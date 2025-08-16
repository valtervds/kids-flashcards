# Kids Flashcards

App React + Vite com TTS, reconhecimento de voz e suporte PWA.

## Scripts
- npm run start – dev server
- npm run build – build produção em dist/

## PWA
Manifesto em public/manifest.webmanifest e sw.js simples para cache offline.

Testar instalação:
1. npm run build
2. npx serve dist (ou outro servidor estático)
3. Abrir no Chrome/Edge e usar "Instalar app".

## Deploy GitHub Pages
Workflow .github/workflows/deploy.yml publica em Pages ao push na branch main.
Após primeiro run:
1. Settings > Pages selecione "GitHub Actions".
2. Aguardar publicação.

## Próximos Passos
- Pontuação, feedback resposta, persistência IndexedDB.
- A11y e testes automatizados.
