import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import type { Deck } from '../../domain/models';
import type { PublishProgress, PublishResult, PublishOptions, PublishEventCallback } from './types';
import { createDeck, updateDeckDoc } from '../../firebase/decksRepo';
import { createDeckMedia } from '../../firebase/deckMediaRepo';
import { uploadDeckAudio } from '../../firebase/storage';

export class PublishService {
  private db: Firestore | null = null;
  private storage: FirebaseStorage | null = null;
  private uid: string | null = null;
  private logs: PublishProgress[] = [];

  constructor(
    db: Firestore | null,
    storage: FirebaseStorage | null,
    uid: string | null
  ) {
    this.db = db;
    this.storage = storage;
    this.uid = uid;
  }

  async publishDeck(
    deck: Deck,
    onProgress: PublishEventCallback,
    options: PublishOptions = {}
  ): Promise<PublishResult> {
    this.logs = [];
    
    try {
      // Validações iniciais
      this.emitProgress('init', 'Iniciando publicação...', 0, onProgress);
      
      if (!this.db) {
        throw new Error('Firebase não está inicializado');
      }

      if (!deck.cards.length) {
        throw new Error('Adicione pelo menos 1 carta antes de publicar');
      }

      // Garantir autenticação
      this.emitProgress('auth', 'Verificando autenticação...', 10, onProgress);
      await this.ensureAuthentication(options.forceReauth);

      if (!this.uid) {
        throw new Error('UID não disponível para publicar');
      }

      // Criar/atualizar deck
      this.emitProgress('deck', 'Salvando deck...', 30, onProgress);
      const cloudId = await this.saveOrUpdateDeck(deck);

      // Upload de áudio
      if (deck.audio && !options.skipAudio) {
        this.emitProgress('audio', 'Processando áudio...', 50, onProgress);
        await this.handleAudio(deck, cloudId);
      }

      // Registrar vídeo
      if (deck.video && !options.skipVideo) {
        this.emitProgress('video', 'Registrando vídeo...', 80, onProgress);
        await this.handleVideo(deck, cloudId);
      }

      this.emitProgress('complete', 'Publicação concluída com sucesso', 100, onProgress);

      return {
        success: true,
        cloudId,
        logs: this.logs
      };

    } catch (error: any) {
      const errorMessage = error?.code || error?.message || String(error);
      this.emitProgress('error', `Erro: ${errorMessage}`, 0, onProgress);
      
      return {
        success: false,
        error: errorMessage,
        logs: this.logs
      };
    }
  }

  private async ensureAuthentication(forceReauth = false): Promise<void> {
    if (this.uid && !forceReauth) return;

    try {
      const { ensureAnonymousAuth } = await import('../../firebase/app');
      this.uid = await ensureAnonymousAuth();
    } catch (error: any) {
      throw new Error(`Falha na autenticação: ${error?.code || error?.message}`);
    }
  }

  private async saveOrUpdateDeck(deck: Deck): Promise<string> {
    if (!this.db || !this.uid) {
      throw new Error('Database ou UID não disponível');
    }

    let cloudId = deck.cloudId;
    
    if (!cloudId) {
      // Criar novo deck
      cloudId = await createDeck(this.db, {
        ownerId: this.uid,
        name: deck.name,
        active: deck.active,
        published: true,
        cards: deck.cards
      });
    } else {
      // Atualizar deck existente
      await updateDeckDoc(this.db, cloudId, {
        name: deck.name,
        active: deck.active,
        published: true,
        cards: deck.cards
      });
    }

    return cloudId;
  }

  private async handleAudio(deck: Deck, cloudId: string): Promise<void> {
    if (!deck.audio || !this.db) return;

    const isRemoteUrl = deck.audio.key.startsWith('http');
    
    if (!isRemoteUrl && this.storage) {
      // Upload de áudio local
      const blob = await this.loadAudioBlob(deck.audio.key);
      if (blob) {
        try {
          const uploadResult = await uploadDeckAudio(this.storage, cloudId, blob, deck.audio.name);
          await updateDeckDoc(this.db, cloudId, {
            audioMeta: {
              fileName: deck.audio.name,
              storagePath: uploadResult.storagePath,
              contentType: deck.audio.type,
              size: deck.audio.size
            },
            published: true
          });
        } catch (error: any) {
          throw new Error(`Falha no upload de áudio: ${error?.code || error?.message}`);
        }
      } else {
        throw new Error(`Áudio local não encontrado: ${deck.audio.key}`);
      }
    } else if (isRemoteUrl) {
      // Referenciar URL remota
      await updateDeckDoc(this.db, cloudId, {
        audioMeta: {
          fileName: deck.audio.name,
          storagePath: deck.audio.key,
          downloadUrl: deck.audio.downloadUrl || deck.audio.key,
          contentType: deck.audio.type,
          size: deck.audio.size
        },
        published: true
      });
    }
  }

  private async handleVideo(deck: Deck, cloudId: string): Promise<void> {
    if (!deck.video || !this.db || !this.uid) return;

    if (deck.video.key.startsWith('http')) {
      try {
        await createDeckMedia(this.db, {
          deckId: cloudId,
          ownerId: this.uid,
          kind: 'video',
          url: deck.video.downloadUrl || deck.video.remotePath || deck.video.key,
          contentType: deck.video.type,
          posterUrl: (deck.video as any).posterUrl
        });
      } catch (error: any) {
        throw new Error(`Falha ao registrar vídeo: ${error?.code || error?.message}`);
      }
    }
  }

  private async loadAudioBlob(key: string): Promise<Blob | null> {
    // Implementação simplificada - idealmente seria injetada como dependência
    try {
      if (!('indexedDB' in window)) return null;
      
      const db = await new Promise<IDBDatabase | null>((resolve) => {
        const req = indexedDB.open('deck-audio-db', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });

      if (!db) return null;

      return new Promise((resolve) => {
        const tx = db.transaction('audios', 'readonly');
        const req = tx.objectStore('audios').get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  private emitProgress(
    stage: PublishProgress['stage'],
    message: string,
    progress: number,
    callback: PublishEventCallback
  ): void {
    const progressEvent: PublishProgress = {
      stage,
      message,
      progress,
      timestamp: Date.now()
    };
    
    this.logs.push(progressEvent);
    callback(progressEvent);
  }
}

// Factory function para facilitar uso
export const createPublishService = (
  db: Firestore | null,
  storage: FirebaseStorage | null,
  uid: string | null
): PublishService => {
  return new PublishService(db, storage, uid);
};
