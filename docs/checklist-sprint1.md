# Checklist — Sprint 1: Sessão de Estudo e Avaliação

- [x] Implementar componente de TTS (Text-to-Speech) para mascote *(voz selecionável, persistência, cancel/retry)*
- [x] Integrar API de reconhecimento de voz (ASR) *(Web Speech API básica, transcrição parcial/final)*
- [x] Criar lógica de validação e processamento da resposta *(normalização acentos/pontuação + avaliação correto/incorreto)*
- [x] Desenvolver algoritmo de avaliação automática *(heurística de similaridade + pontuação 1–5 implementada; refinamentos futuros: pesos por tipo de erro, tempo de resposta)*
- [x] Criar componente visual de estrelas *(renderização básica concluída; pendente: animação de entrada/pulso e acessibilidade ARIA melhorada)*
- [~] Integrar feedback sonoro e animações *(placeholder beep para acerto/erro; faltam sons diferenciados, animação do mascote e transições nas estrelas)*
- [~] Testar fluxo completo de sessão de estudo *(Jest configurado + 1 teste básico verde; faltam casos edge: acentos, similaridade parcial, troca de pergunta, auto-avaliação voz)*

Legenda: [x] concluído | [~] parcial | [ ] pendente

Progresso estimado: 5/7 itens concluídos (≈71%), 2 parciais.

Próximos passos sugeridos (mini backlog incremental dentro da sprint):
1. Adicionar sons distintos (sucesso/falha) e pequena animação CSS nas estrelas (scale + fade) — baixa complexidade.
2. Criar 4–6 testes adicionais cobrindo: normalização com acento, resposta parcialmente correta (score 3), resposta muito distante (score 1), avanço para próxima pergunta reseta estado, auto-avaliação por voz desligada x ligada.
3. Refinar componente `Stars` para incluir atributo `aria-label` descrevendo score e role="img"; adicionar animação opcional.
4. Introduzir estrutura para futuras métricas (ex: tempo de resposta) no objeto de resultado sem quebrar API atual.
5. (Opcional) Substituir placeholder beeps por assets curtos (≤10kb) e pré-carregar no `useEffect`.

---

Use este checklist para acompanhar o progresso das tarefas do Sprint 1. Marque cada item conforme for concluído e utilize os agentes BMAD para dúvidas, revisão ou acompanhamento.
