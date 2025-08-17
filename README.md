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
Configurado via workflow `.github/workflows/deploy-pages.yml`.

Passos:
1. Verifique que `base` em `vite.config.ts` está `/kids-flashcards/` (ajuste se o repositório tiver outro nome).
2. Ative em Settings > Pages > Source: "GitHub Actions" (apenas primeira vez).
3. Push na branch `main` dispara build e deploy automático.
4. URL final: `https://<seu-usuario>.github.io/kids-flashcards/`.

Re-disparo manual: aba Actions > Deploy GitHub Pages > Run workflow.

Observações:
- Service Worker não registra em `localhost` para evitar cache antigo em dev.
- Em produção (Pages) o SW é registrado para PWA/offline.

## Próximos Passos
- Refinar estatísticas de sessão.
- Melhorar divisão de chunks (reduzir vendor ~700KB).
- Otimizar Firebase load sob demanda.
- Mais testes (auto-seleção de deck, fluxo de áudio).
