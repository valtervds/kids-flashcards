// Centraliza lógica de normalização e avaliação para facilitar testes
export const normalizar = (txt: string) => txt
  .toLowerCase()
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .replace(/[!?.,;:\-–_]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

export const respostasCorretas: Record<number, string[]> = {
  0: ['brasilia', 'brasília'],
  1: ['7', 'sete'],
  2: ['cartao de memorizacao', 'cartão de memorização', 'cartao de estudo', 'cartão de estudo', 'ferramenta de estudo']
};

export interface ResultadoAvaliacao {
  correto: boolean;
  score: number; // 1-5
  detalhes: string;
  similaridade?: number; // 0-1 para futuras métricas
}

export function avaliar(perguntaIndex: number, resposta: string): ResultadoAvaliacao {
  const base = normalizar(resposta);
  const lista = respostasCorretas[perguntaIndex] || [];
  const match = lista.find(r => normalizar(r) === base);
  if (match) {
    return { correto: true, score: 5, detalhes: 'Correspondência exata', similaridade: 1 };
  }
  const palavrasResp = base.split(' ');
  let melhor = 0;
  for (const g of lista) {
    const gw = normalizar(g).split(' ');
    const inter = gw.filter(w => palavrasResp.includes(w));
    const ratio = inter.length / Math.max(gw.length, 1);
    if (ratio > melhor) melhor = ratio;
  }
  let score = 1;
  if (melhor >= 0.8) score = 4; else if (melhor >= 0.5) score = 3; else if (melhor >= 0.3) score = 2;
  return { correto: false, score, detalhes: `Similaridade ${(melhor * 100).toFixed(0)}%`, similaridade: melhor };
}
