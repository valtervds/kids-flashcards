# Especificação Técnica — App Kids Flashcards

> Arquitetura orientada a componentização extrema e Context Engineering (BMAD Method), para PWA em iOS/iPadOS.

## Princípios de Arquitetura
- Componentização Extrema (átomos, moléculas, organismos).
- Separação UI/Domínio/Infra.
- Ports & Adapters (Hexagonal).
- Offline-first (IndexedDB + Workbox SW).
- Acessibilidade (WCAG 2.1 AA) e desempenho (Lighthouse ≥ 90).

## Módulos
- UI: atoms, molecules, organisms, themes.
- Domínio: SRS, scoring, tips, importers (Anki).
- Infra: voice (TTS/ASR), data (repos, sync), pwa (manifest, SW).
- Features: estudo, progresso, gamificação.
- Context: PRD, stories, guides.

## Tecnologias
- React + TypeScript (Vite/Next).
- Tailwind + tokens de design, Framer Motion.
- Zustand + XState.
- IndexedDB (Dexie), Zod schemas.
- Vitest/Jest, Playwright.

## Máquinas XState
- SessaoEstudo: idle → lendoPergunta → aguardandoResposta → avaliando → feedback → próximo.
- Voz: permCheck → ready → recording → processing.
- ImportAnki: idle → analisando → mapeando → importando → concluído.
- Sync: offline → conectando → enviando → merged.

## PWA iOS
- Manifest com ícones maskable e apple-touch-icon.
- Service Worker com precache e runtime cache.
- Web Push (iOS ≥ 16.4), áudio/mic on-gesture.
- Splash screen otimizada.

## Segurança
- TLS 1.3, dados locais cifrados (WebCrypto).
- Processamento local preferencial para voz.
