import { useCallback, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import type { Deck } from '../../domain/models';
import { createPublishService } from './publishService';
import type { PublishProgress, PublishResult, PublishOptions } from './types';

interface UsePublishServiceOptions {
  firebaseEnabled: boolean;
  firebaseUid: string | null;
  cloudDbRef: Firestore | null;
  cloudStorageRef: FirebaseStorage | null;
  loadAudioBlob: (key: string) => Promise<Blob | null>;
  updateDeck: (id: string, partial: Partial<Deck>) => void;
  setFirebaseUid: (uid: string) => void;
  setFirebaseStatus: (status: string) => void;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface UsePublishServiceReturn {
  publishDeck: (deck: Deck, options?: PublishOptions) => Promise<PublishResult>;
  isPublishing: boolean;
  progress: PublishProgress | null;
  logs: Record<string, string[]>;
  clearLogs: (deckId: string) => void;
}

export const usePublishService = (options: UsePublishServiceOptions): UsePublishServiceReturn => {
  const [isPublishing, setIsPublishing] = useState(false);
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [logs, setLogs] = useState<Record<string, string[]>>({});

  const clearLogs = useCallback((deckId: string) => {
    setLogs(prev => ({ ...prev, [deckId]: [] }));
  }, []);

  const appendLog = useCallback((deckId: string, message: string) => {
    setLogs(prev => {
      const list = prev[deckId] ? [...prev[deckId]] : [];
      const timestamp = new Date().toLocaleTimeString();
      list.push(`${timestamp} ${message}`);
      if (list.length > 100) list.splice(0, list.length - 100);
      return { ...prev, [deckId]: list };
    });
  }, []);

  const publishDeck = useCallback(async (
    deck: Deck,
    publishOptions?: PublishOptions
  ): Promise<PublishResult> => {
    if (!options.firebaseEnabled) {
      const error = 'Firebase não habilitado';
      options.onError?.(error);
      return { success: false, error, logs: [] };
    }

    if (!options.cloudDbRef) {
      const error = 'Firebase não pronto';
      options.onError?.(error);
      return { success: false, error, logs: [] };
    }

    if (!deck.cards.length) {
      appendLog(deck.id, 'Publicação cancelada: baralho vazio.');
      const error = 'Adicione pelo menos 1 carta antes de publicar (requisito das regras).';
      options.onError?.(error);
      return { success: false, error, logs: [] };
    }

    setIsPublishing(true);
    setProgress({ 
      stage: 'initializing', 
      message: 'Iniciando publicação...', 
      progress: 0,
      timestamp: Date.now()
    });

    try {
      const service = createPublishService(
        options.cloudDbRef, 
        options.cloudStorageRef, 
        options.firebaseUid
      );

      const result = await service.publishDeck(
        deck,
        (progressEvent) => {
          setProgress(progressEvent);
          appendLog(deck.id, progressEvent.message);
        },
        publishOptions
      );

      if (result.success) {
        appendLog(deck.id, 'Publicação concluída com sucesso.');
        options.onSuccess?.();
      } else {
        appendLog(deck.id, `Erro: ${result.error}`);
        options.onError?.(result.error || 'Erro desconhecido');
      }

      return result;
    } catch (error: any) {
      const errorMessage = error?.code || error?.message || String(error);
      appendLog(deck.id, `Erro: ${errorMessage}`);
      options.onError?.(errorMessage);
      return { success: false, error: errorMessage, logs: [] };
    } finally {
      setIsPublishing(false);
      setProgress(null);
    }
  }, [options, appendLog]);

  return {
    publishDeck,
    isPublishing,
    progress,
    logs,
    clearLogs
  };
};
