import { useState, useEffect, useCallback } from 'react';
import { Deck, Flashcard } from '../../domain/models';

const loadDecks = (): Deck[] => {
  try { const raw = localStorage.getItem('decks.all'); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  try { const legacy = localStorage.getItem('deck.imported'); if (legacy) { const cards: Flashcard[] = JSON.parse(legacy); return [{ id: 'importado', name: 'Importado', active: true, cards, createdAt: Date.now() }]; } } catch { /* ignore */ }
  return [];
};

export function useLocalDecks() {
  const [decks, setDecks] = useState<Deck[]>(loadDecks);
  useEffect(() => { try { localStorage.setItem('decks.all', JSON.stringify(decks)); } catch { /* ignore */ } }, [decks]);

  const addDeck = useCallback((name: string, cards: Flashcard[]) => {
    setDecks(prev => [...prev, { id: crypto.randomUUID(), name, active: true, cards, createdAt: Date.now() }]);
  }, []);
  const updateDeckMeta = useCallback((id: string, data: Partial<Pick<Deck,'name'|'active'>>) => {
    setDecks(prev => prev.map(d => d.id === id ? { ...d, ...data } : d));
  }, []);
  const deleteDeckLocal = useCallback((id: string) => {
    setDecks(prev => prev.filter(d => d.id !== id));
  }, []);

  return { decks, setDecks, addDeck, updateDeckMeta, deleteDeckLocal };
}
