import { useRef, useCallback } from 'react';
import { updateProgress } from '../../../firebase/progressRepo';

interface QueueItem { deckId:string; card:number; score:number; correct:boolean }
interface SessionInc { deckId:string }

interface Params {
  enabled: boolean;
  dbRef: React.MutableRefObject<any>;
  userId: string | null;
}

export function useRemoteProgressQueue({ enabled, dbRef, userId }: Params) {
  const queueRef = useRef<QueueItem[]>([]);
  const sessionsRef = useRef<SessionInc[]>([]);
  const timerRef = useRef<any>(null);

  const flush = useCallback(async () => {
    if (!enabled || !dbRef.current || !userId) return;
    if (!queueRef.current.length && !sessionsRef.current.length) return;
    const grouped: Record<string, {answers:QueueItem[]; sessions:number}> = {};
    queueRef.current.forEach(r => { grouped[r.deckId] = grouped[r.deckId] || { answers:[], sessions:0 }; grouped[r.deckId].answers.push(r); });
    sessionsRef.current.forEach(r => { grouped[r.deckId] = grouped[r.deckId] || { answers:[], sessions:0 }; grouped[r.deckId].sessions += 1; });
    queueRef.current = [];
    sessionsRef.current = [] as any;
    for (const deckId of Object.keys(grouped)) {
      const g = grouped[deckId];
      await updateProgress(dbRef.current, userId, deckId, cur => {
        const perCard = { ...(cur.perCard||{}) } as any;
        let attemptsTotal = cur.attemptsTotal || 0;
        let correctTotal = cur.correctTotal || 0;
        g.answers.forEach(a => {
          const slot = perCard[a.card] || { scores:[], attempts:0, correct:0 };
          slot.scores = [...slot.scores, a.score]; if (slot.scores.length>50) slot.scores = slot.scores.slice(-50);
          slot.attempts += 1; if (a.correct) slot.correct += 1;
          perCard[a.card] = slot;
          attemptsTotal += 1; if (a.correct) correctTotal += 1;
        });
        const sessions = (cur.sessions||0) + g.sessions;
        return { perCard, attemptsTotal, correctTotal, sessions } as any;
      });
    }
  }, [enabled, dbRef, userId]);

  const scheduleFlush = useCallback(() => {
    if (!enabled) return;
    if (timerRef.current) return;
    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      await flush();
    }, 1000);
  }, [enabled, flush]);

  const queueAnswer = useCallback((deckId:string, card:number, score:number, correct:boolean) => {
    if (!enabled) return;
    queueRef.current.push({ deckId, card, score, correct });
  }, [enabled]);

  const queueSession = useCallback((deckId:string) => {
    if (!enabled) return;
    sessionsRef.current.push({ deckId });
  }, [enabled]);

  return { queueAnswer, queueSession, scheduleFlush, flush, hasPending: () => queueRef.current.length>0 || sessionsRef.current.length>0 };
}
