# Sync Cloud (Fase 1)

Este documento descreve a evolução planejada para migrar baralhos / progresso / áudio para Firebase.

## Estado Atual
- Sync simples custom (`cloudSync.ts`) salva JSON único (sem áudio) para um userId manual.
- Áudio permanece local (IndexedDB).

## Próxima Fase
1. Autenticação anônima Firebase.
2. Coleção decks publicada (metadados e cartas).
3. Storage para áudio.
4. Progresso por usuário.

## Variáveis de Ambiente (exemplo .env.local)
VITE_FB_API_KEY=...
VITE_FB_AUTH_DOMAIN=...
VITE_FB_PROJECT_ID=...
VITE_FB_STORAGE_BUCKET=...
VITE_FB_APP_ID=...

## Notas
- Manteremos fallback offline usando persistence do Firestore.
- Versão dos decks controla invalidar progresso obsoleto.
