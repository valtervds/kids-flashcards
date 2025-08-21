import type { Deck, Flashcard } from '../../domain/models';

export interface DeckContextValue {
  // Estado
  decks: Deck[];
  currentDeckId: string;
  
  // Ações CRUD
  addDeck: (name: string, cards: Flashcard[]) => string;
  updateDeck: (id: string, partial: Partial<Deck>) => void;
  deleteDeck: (id: string) => void;
  
  // Gestão de cartas
  addCard: (deckId: string, card: Flashcard) => void;
  updateCard: (deckId: string, index: number, card: Flashcard) => void;
  deleteCard: (deckId: string, index: number) => void;
  
  // Navegação
  setCurrentDeckId: (id: string) => void;
  getCurrentDeck: () => Deck | null;
  
  // Utilidades
  cloneCloudDeck: (cloudDeck: Deck) => string;
}
