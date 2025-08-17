import { useState, useEffect, useRef, useCallback } from 'react';
import { avaliar } from '../../../evaluation';
import { Deck } from '../../../domain/models';
import { respostasCorretas } from '../../../evaluation';
import { gerarDica, obterRespostaCorretaPreferida } from '../../../utils/scoring';
import { useStudySession } from './useStudySession';
import { useAnswerEvaluation } from './useAnswerEvaluation';

interface Params {
  getCurrentDeck: () => Deck | null;
  defaultPerguntas: string[];
  usandoDeckImportado: boolean;
  firebaseEnabled: boolean;
  firebaseUid: string | null;
  cloudDbRef: React.MutableRefObject<any>;
  recordAttempt: (deckId: string, correto: boolean) => void;
  recordSession: (deckId: string) => void;
  setProgress: React.Dispatch<React.SetStateAction<Record<string, Record<number, number[]>>>>;
  remoteQueueApi: { queueAnswer: Function; scheduleFlush: Function; queueSession: Function };
  safePlay: (tipo: 'ok' | 'erro') => void;
}

export function useStudyEngine(p: Params) {
  const {
    getCurrentDeck, defaultPerguntas, usandoDeckImportado, firebaseEnabled, firebaseUid, cloudDbRef,
    recordAttempt, recordSession, setProgress, remoteQueueApi, safePlay
  } = p;
  const debug = false; // toggle manual para investigar
  if (debug && process.env.NODE_ENV !== 'production') console.log('[studyEngine:init]', { deck: getCurrentDeck()?.id, usandoDeckImportado });

  const perguntas = getCurrentDeck() ? getCurrentDeck()!.cards.map(c => c.question) : defaultPerguntas;
  const { indice, setIndice, proxima: proximaPerguntaBase } = useStudySession(perguntas);

  const [respostaEntrada, setRespostaEntrada] = useState('');
  const [origemUltimaEntrada, setOrigemUltimaEntrada] = useState<'voz' | 'manual' | null>(null);
  const [resultado, setResultado] = useState<any>(null);
  const [autoAvaliarVoz, setAutoAvaliarVoz] = useState(true);
  const [revelarQtde, setRevelarQtde] = useState(0);
  const [mostrarRespostaCorreta, setMostrarRespostaCorreta] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [ultimoTempoRespostaMs, setUltimoTempoRespostaMs] = useState<number | null>(null);
  const [inicioPerguntaTs, setInicioPerguntaTs] = useState(Date.now());

  // Avaliação
  const { resultado: resultadoHook, submeter: submeterHook, ultimoTempoRespostaMs: ultimoTempoHook, resetForNextQuestion } = useAnswerEvaluation({
    getCurrentDeck,
    usandoDeckImportado,
    indice,
    avaliarFallback: (i:number, v:string) => avaliar(i, v) as any,
    safePlay,
    recordAttempt: (deckId, correto) => recordAttempt(deckId, correto),
    setProgress,
    firebaseEnabled,
    firebaseUid,
    cloudDbRef,
    queueAnswer: remoteQueueApi.queueAnswer as any,
    scheduleFlush: remoteQueueApi.scheduleFlush as any
  } as any);

  useEffect(() => {
    setResultado(resultadoHook as any); setUltimoTempoRespostaMs(ultimoTempoHook);
  }, [resultadoHook, ultimoTempoHook]);

  // Reset ao mudar perguntas (mudança de deck)
  useEffect(() => {
  if (debug && process.env.NODE_ENV !== 'production') console.log('[studyEngine:deckChange]', getCurrentDeck()?.id, 'resetando estado');
    setIndice(0);
    setRespostaEntrada(''); setResultado(null); setOrigemUltimaEntrada(null); setRevelarQtde(0); setMostrarRespostaCorreta(false); setMostrarHistorico(false); setUltimoTempoRespostaMs(null); setInicioPerguntaTs(Date.now()); resetForNextQuestion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getCurrentDeck()?.id]);

  const submeter = (origem: 'voz' | 'manual') => {
    if (!respostaEntrada.trim()) return;
  if (debug && process.env.NODE_ENV !== 'production') console.log('[studyEngine:submit]', { origem, respostaEntrada, indice });
    submeterHook(respostaEntrada);
  };

  const proximaPergunta = () => {
    if (!perguntas.length) return;
  if (debug && process.env.NODE_ENV !== 'production') console.log('[studyEngine:next]', { antes: indice, total: perguntas.length });
    proximaPerguntaBase();
    setRespostaEntrada(''); setResultado(null); setMostrarRespostaCorreta(false); setOrigemUltimaEntrada(null);
    setRevelarQtde(0); setUltimoTempoRespostaMs(null); setInicioPerguntaTs(Date.now()); resetForNextQuestion();
    if (perguntas.length && (indice + 1) % perguntas.length === 0) {
      const deckIdForSession = usandoDeckImportado ? (getCurrentDeck()?.id || 'default') : 'default';
  recordSession(deckIdForSession);
  if (debug && process.env.NODE_ENV !== 'production') console.log('[studyEngine:sessionComplete]', { deckIdForSession });
      if (firebaseEnabled && getCurrentDeck()?.cloudId && firebaseUid && cloudDbRef.current) {
        remoteQueueApi.queueSession(getCurrentDeck()!.cloudId!);
        remoteQueueApi.scheduleFlush();
      }
    }
  };

  const deckKeyForHistory = usandoDeckImportado ? (getCurrentDeck()?.id || 'default') : (getCurrentDeck()?.cloudId ? getCurrentDeck()!.id : 'default');
  const obterRespostaCorreta = (i:number) => obterRespostaCorretaPreferida(getCurrentDeck(), respostasCorretas, usandoDeckImportado, i);
  const gerarDicaComputed = (i:number) => gerarDica({ deck: getCurrentDeck(), respostasCorretas, usandoDeckImportado, indice: i, qt: revelarQtde, respostaEntrada });

  return {
    perguntas,
    indice, setIndice,
    respostaEntrada, setRespostaEntrada,
    origemUltimaEntrada, setOrigemUltimaEntrada,
    autoAvaliarVoz, setAutoAvaliarVoz,
    revelarQtde, setRevelarQtde,
    mostrarRespostaCorreta, setMostrarRespostaCorreta,
    mostrarHistorico, setMostrarHistorico,
    resultado,
    ultimoTempoRespostaMs,
    submeter,
    proximaPergunta,
    deckKeyForHistory,
    obterRespostaCorreta,
    gerarDicaComputed,
    startTime: inicioPerguntaTs
  };
}
