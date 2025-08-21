import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import type { Deck } from '../../domain/models';
import type { CloudContextValue, CloudState } from './types';
import { resolveFirebaseConfig } from '../../firebase/defaultConfig';
import { createDeck, updateDeckDoc, listenPublishedDecks, deleteDeckDoc } from '../../firebase/decksRepo';
import { createDeckMedia } from '../../firebase/deckMediaRepo';
import { uploadDeckAudio } from '../../firebase/storage';
import { useToast } from '../../components/ui/Toast';

const CloudContext = createContext<CloudContextValue | null>(null);

interface CloudProviderProps {
  children: React.ReactNode;
  updateDeck: (id: string, partial: Partial<Deck>) => void;
}

export const CloudProvider: React.FC<CloudProviderProps> = ({ children, updateDeck }) => {
  const { showToast } = useToast();
  
  // Estado Firebase
  const firebaseEnv = resolveFirebaseConfig();
  const firebaseAvailable = !!firebaseEnv.apiKey && process.env.NODE_ENV !== 'test';
  
  const [firebaseEnabled, setFirebaseEnabled] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState('Offline');
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [cloudDecks, setCloudDecks] = useState<Deck[]>([]);
  const [cloudDecksLoaded, setCloudDecksLoaded] = useState(false);
  const [publishLogs, setPublishLogs] = useState<Record<string, string[]>>({});
  
  // Refs para instâncias Firebase
  const cloudDbRef = useRef<Firestore | null>(null);
  const cloudStorageRef = useRef<FirebaseStorage | null>(null);
  
  // IndexedDB para áudio
  const openAudioDb = useCallback(() => new Promise<IDBDatabase | null>((resolve) => {
    if (!('indexedDB' in window)) return resolve(null);
    const req = indexedDB.open('deck-audio-db', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('audios')) {
        db.createObjectStore('audios');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  }), []);

  const saveAudioBlob = useCallback(async (key: string, blob: Blob): Promise<boolean> => {
    const db = await openAudioDb();
    if (!db) return false;
    
    return new Promise<boolean>((resolve) => {
      const tx = db.transaction('audios', 'readwrite');
      tx.objectStore('audios').put(blob, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }, [openAudioDb]);

  const loadAudioBlob = useCallback(async (key: string): Promise<Blob | null> => {
    const db = await openAudioDb();
    if (!db) return null;
    
    return new Promise<Blob | null>((resolve) => {
      const tx = db.transaction('audios', 'readonly');
      const request = tx.objectStore('audios').get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }, [openAudioDb]);

  const deleteAudioBlob = useCallback(async (key: string): Promise<void> => {
    const db = await openAudioDb();
    if (!db) return;
    
    const tx = db.transaction('audios', 'readwrite');
    tx.objectStore('audios').delete(key);
  }, [openAudioDb]);

  // Logs de publicação
  const appendPublishLog = useCallback((deckId: string, message: string) => {
    setPublishLogs(prev => {
      const list = prev[deckId] ? [...prev[deckId]] : [];
      const timestamp = new Date().toLocaleTimeString();
      list.push(`${timestamp} ${message}`);
      if (list.length > 100) list.splice(0, list.length - 100);
      return { ...prev, [deckId]: list };
    });
  }, []);

  const clearPublishLogs = useCallback((deckId: string) => {
    setPublishLogs(prev => ({ ...prev, [deckId]: [] }));
  }, []);

  // Inicialização Firebase
  const initFirebase = useCallback(async () => {
    if (!firebaseAvailable || cloudDbRef.current) return;
    
    try {
      setFirebaseStatus('Conectando...');
      const { initFirebaseApp, ensureAnonymousAuth } = await import('../../firebase/app');
      
      console.log('[CloudContext] Inicializando Firebase', firebaseEnv);
      const { db, storage, auth } = await initFirebaseApp(firebaseEnv);
      const uid = await ensureAnonymousAuth(auth);
      
      console.log('[CloudContext] Firebase inicializado', { uid });
      setFirebaseUid(uid);
      cloudDbRef.current = db;
      cloudStorageRef.current = storage;
      
      // Listener para decks publicados
      listenPublishedDecks(db, (list: any[]) => {
        console.log('[CloudContext] Decks publicados recebidos:', list.length);
        const mapped: Deck[] = list.map((d: any) => ({
          id: d.id,
          name: d.name,
          active: true,
          createdAt: Date.now(),
          cards: d.cards || [],
          published: d.published,
          cloudId: d.id,
          audio: d.audioMeta ? {
            name: d.audioMeta.fileName,
            size: d.audioMeta.size || 0,
            type: d.audioMeta.contentType || 'audio/mpeg',
            key: d.audioMeta.storagePath,
            remotePath: d.audioMeta.storagePath
          } : undefined
        }));
        
        setCloudDecks(mapped);
        setCloudDecksLoaded(true);
      }, (error: any) => {
        console.warn('[CloudContext] Erro no listener de decks:', error);
        setFirebaseStatus('Online (listener erro - fallback polling)');
      });
      
      setFirebaseEnabled(true);
      setFirebaseStatus('Online');
    } catch (error: any) {
      console.warn('[CloudContext] Erro ao inicializar Firebase:', error);
      setFirebaseStatus('Erro conexão');
      setFirebaseEnabled(false);
    }
  }, [firebaseAvailable, firebaseEnv]);

  const forceFirebaseInit = useCallback(async () => {
    appendPublishLog('global', 'Forçando init Firebase...');
    cloudDbRef.current = null;
    cloudStorageRef.current = null;
    setFirebaseEnabled(false);
    setFirebaseUid(null);
    await initFirebase();
  }, [initFirebase, appendPublishLog]);

  // Autenticação
  const ensureAuth = useCallback(async (): Promise<string> => {
    if (firebaseUid) return firebaseUid;
    
    try {
      const { ensureAnonymousAuth } = await import('../../firebase/app');
      const uid = await ensureAnonymousAuth();
      setFirebaseUid(uid);
      return uid;
    } catch (error: any) {
      throw new Error(`Falha na autenticação: ${error?.code || error?.message || String(error)}`);
    }
  }, [firebaseUid]);

  // Publicação de deck
  const publishDeck = useCallback(async (deck: Deck) => {
    if (!firebaseEnabled) {
      showToast('error', 'Firebase não habilitado');
      return;
    }
    
    if (!cloudDbRef.current) {
      showToast('error', 'Firebase não pronto');
      return;
    }
    
    if (!deck.cards.length) {
      appendPublishLog(deck.id, 'Publicação cancelada: baralho vazio.');
      showToast('error', 'Baralho vazio', 'Adicione pelo menos 1 carta antes de publicar.');
      return;
    }

    try {
      console.log('[CloudContext] Iniciando publicação', { deckId: deck.id, cloudId: deck.cloudId, name: deck.name });
      appendPublishLog(deck.id, 'Iniciando publicação...');
      setFirebaseStatus('Publicando...');
      
      // Garantir autenticação
      const uid = await ensureAuth();
      
      let cloudId = deck.cloudId;
      if (!cloudId) {
        cloudId = await createDeck(cloudDbRef.current, {
          ownerId: uid,
          name: deck.name,
          active: deck.active,
          published: true,
          cards: deck.cards
        });
        updateDeck(deck.id, { cloudId, published: true });
        console.log('[CloudContext] Deck criado', { cloudId });
        appendPublishLog(deck.id, `Deck criado na nuvem (id=${cloudId}).`);
      } else {
        await updateDeckDoc(cloudDbRef.current, cloudId, {
          name: deck.name,
          active: deck.active,
          published: true,
          cards: deck.cards
        });
        console.log('[CloudContext] Deck atualizado', { cloudId });
        appendPublishLog(deck.id, `Deck atualizado (id=${cloudId}).`);
      }
      
      // Upload de áudio se necessário
      if (deck.audio) {
        const isRemoteUrl = deck.audio.key.startsWith('http');
        if (!isRemoteUrl && cloudStorageRef.current) {
          const blob = await loadAudioBlob(deck.audio.key);
          if (blob) {
            try {
              appendPublishLog(deck.id, 'Enviando áudio...');
              const upload = await uploadDeckAudio(cloudStorageRef.current, cloudId!, blob, deck.audio.name);
              await updateDeckDoc(cloudDbRef.current, cloudId!, {
                audioMeta: {
                  fileName: deck.audio.name,
                  storagePath: upload.storagePath,
                  contentType: deck.audio.type,
                  size: deck.audio.size
                },
                published: true
              });
              console.log('[CloudContext] Áudio enviado', { cloudId, storagePath: upload.storagePath });
              appendPublishLog(deck.id, 'Áudio enviado e metadata salva.');
            } catch (error: any) {
              console.error('[CloudContext] Falha upload áudio', error);
              appendPublishLog(deck.id, 'Falha upload áudio: ' + (error?.code || error?.message || String(error)));
            }
          } else {
            appendPublishLog(deck.id, 'Áudio local não encontrado para upload (IndexedDB) chave ' + deck.audio.key);
          }
        } else if (isRemoteUrl) {
          await updateDeckDoc(cloudDbRef.current, cloudId!, {
            audioMeta: {
              fileName: deck.audio.name,
              storagePath: deck.audio.key,
              downloadUrl: deck.audio.downloadUrl || deck.audio.key,
              contentType: deck.audio.type,
              size: deck.audio.size
            },
            published: true
          });
          appendPublishLog(deck.id, 'Áudio remoto (URL) referenciado sem upload.');
        }
      }
      
      // Registro de vídeo se existir
      if (deck.video && deck.video.key.startsWith('http')) {
        try {
          appendPublishLog(deck.id, 'Registrando vídeo...');
          await createDeckMedia(cloudDbRef.current, {
            deckId: cloudId!,
            ownerId: uid,
            kind: 'video',
            url: deck.video.downloadUrl || deck.video.remotePath || deck.video.key,
            contentType: deck.video.type,
            posterUrl: (deck.video as any).posterUrl
          });
          appendPublishLog(deck.id, 'Vídeo registrado.');
        } catch (error: any) {
          appendPublishLog(deck.id, 'Falha registrar vídeo: ' + (error?.code || error?.message || String(error)));
        }
      }
      
      setFirebaseStatus('Publicado');
      console.log('[CloudContext] Publicação finalizada com sucesso');
      appendPublishLog(deck.id, 'Publicação concluída com sucesso.');
      showToast('success', 'Publicação concluída', 'Deck publicado na nuvem com sucesso.');
      
    } catch (error: any) {
      console.error('[CloudContext] Erro na publicação', error);
      const code = error?.code || error?.message || String(error);
      setFirebaseStatus('Erro publicar');
      appendPublishLog(deck.id, 'Erro: ' + code);
      
      if (String(code).includes('permission-denied') || String(code).includes('Missing or insufficient permissions')) {
        appendPublishLog(deck.id, 'Permission denied: confirme que ownerId == request.auth.uid e regras permitem create/update.');
        appendPublishLog(deck.id, 'Debug: uid atual=' + firebaseUid + ' cloudId=' + (deck.cloudId || '-'));
      }
      
      showToast('error', 'Erro na publicação', 'Falha ao publicar deck. Código: ' + code);
    }
  }, [firebaseEnabled, ensureAuth, updateDeck, loadAudioBlob, firebaseUid, appendPublishLog, showToast]);

  const refreshCloudDecks = useCallback(async () => {
    // Implementação futura para refresh manual dos decks
    if (cloudDbRef.current) {
      // Forçar re-fetch dos decks publicados
      console.log('[CloudContext] Refresh de decks solicitado');
    }
  }, []);

  // Legacy compatibility functions
  const publishDeckFirebase = useCallback(async (deck: Deck) => {
    return publishDeck(deck);
  }, [publishDeck]);

  const deleteDeckDocWrapper = useCallback(async (db: Firestore, cloudId: string) => {
    try {
      await deleteDeckDoc(db, cloudId);
    } catch (error: any) {
      console.error('[CloudContext] Erro ao deletar deck doc', error);
      throw error;
    }
  }, []);

  // Inicialização automática
  useEffect(() => {
    if (firebaseAvailable && !firebaseEnabled) {
      initFirebase();
    }
  }, [firebaseAvailable, firebaseEnabled, initFirebase]);

  const contextValue: CloudContextValue = {
    // Estado
    firebaseEnabled,
    firebaseAvailable,
    firebaseStatus,
    firebaseUid,
    cloudDbRef: cloudDbRef.current,
    cloudStorageRef: cloudStorageRef.current,
    cloudDecks,
    cloudDecksLoaded,
    publishLogs,
    
    // Ações
    initFirebase,
    forceFirebaseInit,
    ensureAuth,
    setFirebaseUid,
    setFirebaseStatus,
    publishDeck,
    publishDeckFirebase,
    deleteDeckDoc: deleteDeckDocWrapper,
    appendPublishLog,
    clearPublishLogs,
    refreshCloudDecks,
    loadAudioBlob,
    saveAudioBlob,
    deleteAudioBlob
  };

  return (
    <CloudContext.Provider value={contextValue}>
      {children}
    </CloudContext.Provider>
  );
};

export const useCloudContext = (): CloudContextValue => {
  const context = useContext(CloudContext);
  if (!context) {
    throw new Error('useCloudContext deve ser usado dentro de um CloudProvider');
  }
  return context;
};
