import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import type { Deck } from '../../domain/models';

export interface CloudState {
  // Configuração e conexão
  firebaseEnabled: boolean;
  firebaseAvailable: boolean;
  firebaseStatus: string;
  firebaseUid: string | null;
  
  // Refs para instâncias Firebase (como React.RefObject para compatibilidade)
  cloudDbRef: Firestore | null;
  cloudStorageRef: FirebaseStorage | null;
  
  // Decks remotos
  cloudDecks: Deck[];
  cloudDecksLoaded: boolean;
  
  // Logs de publicação
  publishLogs: Record<string, string[]>;
}

export interface CloudActions {
  // Inicialização
  initFirebase: () => Promise<void>;
  forceFirebaseInit: () => Promise<void>;
  
  // Autenticação
  ensureAuth: () => Promise<string>;
  setFirebaseUid: (uid: string) => void;
  setFirebaseStatus: (status: string) => void;
  
  // Publicação
  publishDeck: (deck: Deck) => Promise<void>;
  publishDeckFirebase: (deck: Deck) => Promise<void>; // Legacy compatibility
  appendPublishLog: (deckId: string, message: string) => void;
  clearPublishLogs: (deckId: string) => void;
  
  // Deck management
  deleteDeckDoc: (db: Firestore, cloudId: string) => Promise<void>;
  
  // Decks remotos
  refreshCloudDecks: () => Promise<void>;
  
  // Storage helpers
  loadAudioBlob: (key: string) => Promise<Blob | null>;
  saveAudioBlob: (key: string, blob: Blob) => Promise<boolean>;
  deleteAudioBlob: (key: string) => Promise<void>;
}

export interface CloudContextValue extends CloudState, CloudActions {}
