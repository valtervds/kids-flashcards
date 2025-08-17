// Tipos centrais de domínio
// DeckAudioMeta: key = local IndexedDB key (ou storagePath quando remoto)
export interface DeckMediaBase { name: string; size: number; type: string; key: string; remotePath?: string; downloadUrl?: string; }
export interface DeckAudioMeta extends DeckMediaBase { }
export interface DeckVideoMeta extends DeckMediaBase { posterUrl?: string; durationSec?: number; }
export interface Flashcard { question: string; answers: string[]; }
export interface Deck { id: string; name: string; active: boolean; cards: Flashcard[]; createdAt: number; audio?: DeckAudioMeta; video?: DeckVideoMeta; published?: boolean; cloudId?: string; }
export interface DeckStats { attempts: number; correct: number; sessions: number; }
export interface ProgressMap { [deckId: string]: { [cardIndex: string]: number[] } }
