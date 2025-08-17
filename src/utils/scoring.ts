import { normalizar } from '../evaluation';
import { Deck } from '../domain/models';

// Retorna a resposta "preferida" para exibição (mantém acentos se houver)
export function obterRespostaCorretaPreferida(deck: Deck | null, respostasCorretas: Record<number,string[]>, usandoDeckImportado: boolean, indice: number) {
  if (!deck && !usandoDeckImportado) return '';
  const lista = usandoDeckImportado ? (deck!.cards[indice]?.answers || []) : (respostasCorretas[indice] || []);
  const preferida = lista.find(r => /[áéíóúãõâêîôûç]/i.test(r)) || lista[0] || '';
  return preferida.charAt(0).toUpperCase() + preferida.slice(1);
}

export function gerarDica(params: {
  deck: Deck | null;
  respostasCorretas: Record<number,string[]>;
  usandoDeckImportado: boolean;
  indice: number;
  qt: number;
  respostaEntrada: string;
}) {
  const { deck, respostasCorretas, usandoDeckImportado, indice, qt, respostaEntrada } = params;
  const correta = obterRespostaCorretaPreferida(deck, respostasCorretas, usandoDeckImportado, indice);
  if (!correta) return 'Sem dados.';
  const palavras = correta.split(/\s+/);
  const normCor = normalizar(correta).split(/\s+/);
  const alunoTokens = normalizar(respostaEntrada).split(/\s+/).filter(Boolean);
  const revealCount = Math.min(qt, palavras.length);
  const exibida = palavras.map((original, idx) => {
    const norm = normCor[idx];
    const alunoTem = alunoTokens.includes(norm);
    if (alunoTem) return original;
    if (idx < revealCount) return original;
    return '▁'.repeat(Math.min(original.length, 10));
  }).join(' ');
  const restantes = normCor.filter((w, idx) => !alunoTokens.includes(w) && idx >= revealCount);
  return `${exibida}${restantes.length ? `  (${restantes.length} palavra(s) faltando)` : ''}`;
}
