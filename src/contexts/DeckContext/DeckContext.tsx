import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Deck, Flashcard } from '../../domain/models';
import type { DeckContextValue } from './types';

const DeckContext = createContext<DeckContextValue | null>(null);

interface DeckProviderProps {
  children: React.ReactNode;
}

export const DeckProvider: React.FC<DeckProviderProps> = ({ children }) => {
  // Estado dos decks - integração com localStorage
  const [decks, setDecks] = useState<Deck[]>(() => {
    try {
      const stored = localStorage.getItem('decks.all');
      if (stored) return JSON.parse(stored);
      
      // Migração de dados legados
      const legacy = localStorage.getItem('deck.imported');
      if (legacy) {
        const cards: Flashcard[] = JSON.parse(legacy);
        return [{
          id: 'importado',
          name: 'Importado',
          active: true,
          cards,
          createdAt: Date.now()
        }];
      }
    } catch (error) {
      console.warn('[DeckProvider] Erro ao carregar decks do localStorage:', error);
    }
    return [];
  });

  const [currentDeckId, setCurrentDeckId] = useState<string>('default');

  // Persistir mudanças no localStorage
  useEffect(() => {
    try {
      localStorage.setItem('decks.all', JSON.stringify(decks));
    } catch (error) {
      console.warn('[DeckProvider] Erro ao salvar decks no localStorage:', error);
    }
  }, [decks]);

  // Ações CRUD para decks
  const addDeck = useCallback((name: string, cards: Flashcard[]): string => {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36).slice(-4);
    const newDeck: Deck = {
      id,
      name,
      active: true,
      cards,
      createdAt: Date.now()
    };
    
    setDecks(prev => [...prev, newDeck]);
    return id;
  }, []);

  const updateDeck = useCallback((id: string, partial: Partial<Deck>) => {
    setDecks(prev => prev.map(deck => 
      deck.id === id ? { ...deck, ...partial } : deck
    ));
  }, []);

  const deleteDeck = useCallback((id: string) => {
    setDecks(prev => prev.filter(deck => deck.id !== id));
    
    // Se o deck deletado era o atual, voltar ao default
    if (currentDeckId === id) {
      setCurrentDeckId('default');
    }
  }, [currentDeckId]);

  // Ações para cartas
  const addCard = useCallback((deckId: string, card: Flashcard) => {
    setDecks(prev => prev.map(deck =>
      deck.id === deckId 
        ? { ...deck, cards: [...deck.cards, card] }
        : deck
    ));
  }, []);

  const updateCard = useCallback((deckId: string, index: number, card: Flashcard) => {
    setDecks(prev => prev.map(deck =>
      deck.id === deckId
        ? { 
            ...deck, 
            cards: deck.cards.map((c, i) => i === index ? card : c) 
          }
        : deck
    ));
  }, []);

  const deleteCard = useCallback((deckId: string, index: number) => {
    setDecks(prev => prev.map(deck =>
      deck.id === deckId
        ? { 
            ...deck, 
            cards: deck.cards.filter((_, i) => i !== index) 
          }
        : deck
    ));
  }, []);

  // Navegação e utilitários
  const getCurrentDeck = useCallback((): Deck | null => {
    if (currentDeckId === 'default') return null;
    return decks.find(deck => deck.id === currentDeckId) || null;
  }, [currentDeckId, decks]);

  const cloneCloudDeck = useCallback((cloudDeck: Deck): string => {
    // Verifica se já existe uma cópia local
    const existing = decks.find(deck => deck.cloudId === cloudDeck.cloudId);
    if (existing) {
      console.warn('[DeckProvider] Deck já clonado:', existing.id);
      return existing.id;
    }

    const id = cloudDeck.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-cloud-' + Date.now().toString(36).slice(-4);
    const clonedDeck: Deck = {
      id,
      name: cloudDeck.name,
      active: true,
      cards: [...cloudDeck.cards], // Clone das cartas
      createdAt: Date.now(),
      cloudId: cloudDeck.cloudId,
      published: true,
      audio: cloudDeck.audio // Referência ao áudio
    };

    setDecks(prev => [...prev, clonedDeck]);
    return id;
  }, [decks]);

  const contextValue: DeckContextValue = {
    // Estado
    decks,
    currentDeckId,
    
    // Ações CRUD
    addDeck,
    updateDeck,
    deleteDeck,
    
    // Gestão de cartas
    addCard,
    updateCard,
    deleteCard,
    
    // Navegação
    setCurrentDeckId,
    getCurrentDeck,
    
    // Utilidades
    cloneCloudDeck
  };

  return (
    <DeckContext.Provider value={contextValue}>
      {children}
    </DeckContext.Provider>
  );
};

export const useDeckContext = (): DeckContextValue => {
  const context = useContext(DeckContext);
  if (!context) {
    throw new Error('useDeckContext deve ser usado dentro de um DeckProvider');
  }
  return context;
};
