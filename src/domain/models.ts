// Tipos centrais de domínio
export interface DeckAudioMeta { name: string; size: number; type: string; key: string; }
export interface Flashcard { question: string; answers: string[]; }
export interface Deck { id: string; name: string; active: boolean; cards: Flashcard[]; createdAt: number; audio?: DeckAudioMeta; published?: boolean; cloudId?: string; }
export interface DeckStats { attempts: number; correct: number; sessions: number; }
export interface ProgressMap { [deckId: string]: { [cardIndex: string]: number[] } }
