import { useState, useEffect } from 'react';
import { DeckStats } from '../../../domain/models';

export function useStats() {
  const loadStats = (): Record<string, DeckStats> => {
    try { const raw = localStorage.getItem('deck.stats'); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
    return {};
  };
  const [stats, setStats] = useState<Record<string, DeckStats>>(loadStats);
  useEffect(() => { try { localStorage.setItem('deck.stats', JSON.stringify(stats)); } catch { /* ignore */ } }, [stats]);

  const recordAttempt = (deckKey: string, correto: boolean) => {
    setStats(prev => {
      const cur = prev[deckKey] || { attempts: 0, correct: 0, sessions: 0 };
      return { ...prev, [deckKey]: { ...cur, attempts: cur.attempts + 1, correct: cur.correct + (correto ? 1 : 0) } };
    });
  };
  const recordSession = (deckKey: string) => {
    setStats(prev => {
      const cur = prev[deckKey] || { attempts: 0, correct: 0, sessions: 0 };
      return { ...prev, [deckKey]: { ...cur, sessions: cur.sessions + 1 } };
    });
  };

  return { stats, setStats, recordAttempt, recordSession };
}
