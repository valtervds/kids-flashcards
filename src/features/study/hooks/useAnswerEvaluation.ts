import { useState, useCallback, useRef } from 'react';
import { normalizar } from '../../../evaluation';
import { Deck } from '../../../domain/models';

export interface EvaluationResult {
  correto: boolean;
  score: number; // 1..5
  detalhes: string;
  similaridade?: number;
}

interface Params {
  getCurrentDeck: () => Deck | null;
  usandoDeckImportado: boolean;
  indice: number;
  avaliarFallback: (indice: number, valor: string) => EvaluationResult; // wrapper sobre avaliar existente
  safePlay: (tipo: 'ok' | 'erro') => void;
  recordAttempt: (deckId: string, correto: boolean) => void;
  setProgress: React.Dispatch<React.SetStateAction<Record<string, Record<number, number[]>>>>;
  firebaseEnabled: boolean;
  firebaseUid: string | null;
  cloudDbRef: React.MutableRefObject<any>;
  queueAnswer: (deckId:string, card:number, score:number, correct:boolean) => void;
  scheduleFlush: () => void;
}

export function useAnswerEvaluation(p: Params) {
  const {
    getCurrentDeck, usandoDeckImportado, indice, avaliarFallback, safePlay,
    recordAttempt, setProgress, firebaseEnabled, firebaseUid, cloudDbRef,
  queueAnswer, scheduleFlush
  } = p;

  const [resultado, setResultado] = useState<EvaluationResult | null>(null);
  const [inicioPerguntaTs, setInicioPerguntaTs] = useState<number>(() => Date.now());
  const [ultimoTempoRespostaMs, setUltimoTempoRespostaMs] = useState<number | null>(null);

  const evaluateImported = useCallback((valor: string): EvaluationResult => {
    const deck = getCurrentDeck();
    if (!deck) return { correto: false, score: 1, detalhes: 'Deck não localizado' };
    const answers = deck.cards[indice]?.answers || [];
    const base = normalizar(valor);
    const match = answers.find(a => normalizar(a) === base);
    if (match) return { correto: true, score: 5, detalhes: 'Correspondência exata', similaridade: 1 };
    const palavrasResp = base.split(' ');
    let melhor = 0;
    for (const g of answers) {
      const gw = normalizar(g).split(' ');
      const inter = gw.filter(w => palavrasResp.includes(w));
      const ratio = inter.length / Math.max(gw.length, 1);
      if (ratio > melhor) melhor = ratio;
    }
    let score = 1;
    if (melhor >= 0.8) score = 4; else if (melhor >= 0.5) score = 3; else if (melhor >= 0.3) score = 2;
    return { correto: false, score, detalhes: `Similaridade ${(melhor * 100).toFixed(0)}%`, similaridade: melhor };
  }, [getCurrentDeck, indice]);

  const submeter = useCallback((valor: string) => {
    if (!valor.trim()) return null;
    const res = usandoDeckImportado ? evaluateImported(valor) : avaliarFallback(indice, valor);
    setResultado(res as any);
    setUltimoTempoRespostaMs(Date.now() - inicioPerguntaTs);
    safePlay(res.correto ? 'ok' : 'erro');
    const deckIdForStats = usandoDeckImportado ? (getCurrentDeck()?.id || 'default') : 'default';
    recordAttempt(deckIdForStats, res.correto);
    // progresso (deckKey decide se local ou default)
    const deckKey = usandoDeckImportado ? (getCurrentDeck()?.id || 'default') : (getCurrentDeck()?.cloudId ? getCurrentDeck()!.id : 'default');
    setProgress(prev => {
      const d = prev[deckKey] || {};
      const arr = d[indice] ? [...d[indice]] : [];
      arr.push(res.correto ? 5 : res.score);
      if (arr.length > 50) arr.splice(0, arr.length - 50);
      return { ...prev, [deckKey]: { ...d, [indice]: arr } };
    });
    if (firebaseEnabled && getCurrentDeck()?.cloudId && firebaseUid && cloudDbRef.current) {
      queueAnswer(getCurrentDeck()!.cloudId!, indice, res.correto ? 5 : res.score, res.correto);
      scheduleFlush();
    }
    return res;
  }, [usandoDeckImportado, evaluateImported, avaliarFallback, indice, inicioPerguntaTs, safePlay, recordAttempt, setProgress, firebaseEnabled, firebaseUid, cloudDbRef, queueAnswer, scheduleFlush, getCurrentDeck]);

  const resetForNextQuestion = useCallback(() => {
    setResultado(null);
    setUltimoTempoRespostaMs(null);
    setInicioPerguntaTs(Date.now());
  }, []);

  return { resultado, submeter, ultimoTempoRespostaMs, inicioPerguntaTs, resetForNextQuestion };
}
