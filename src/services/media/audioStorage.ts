import { useRef, useCallback } from 'react';
import { DeckAudioMeta } from '../../domain/models';

// IndexedDB for offline audio storage
export const useAudioStorage = () => {
  const audioUrlCache = useRef<Record<string, string>>({});

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
    return new Promise<boolean>((res) => { 
      const tx = db.transaction('audios', 'readwrite'); 
      tx.objectStore('audios').put(blob, key); 
      tx.oncomplete = () => res(true); 
      tx.onerror = () => res(false); 
    });
  }, [openAudioDb]);

  const loadAudioBlob = useCallback(async (key: string): Promise<Blob | null> => {
    const db = await openAudioDb(); 
    if (!db) return null;
    return new Promise((res) => { 
      const tx = db.transaction('audios', 'readonly'); 
      const r = tx.objectStore('audios').get(key); 
      r.onsuccess = () => res(r.result || null); 
      r.onerror = () => res(null); 
    });
  }, [openAudioDb]);

  const deleteAudioBlob = useCallback(async (key: string): Promise<void> => { 
    const db = await openAudioDb(); 
    if (!db) return; 
    const tx = db.transaction('audios', 'readwrite'); 
    tx.objectStore('audios').delete(key); 
  }, [openAudioDb]);

  const getAudioObjectUrl = useCallback(async (meta?: DeckAudioMeta): Promise<string | undefined> => {
    if (!meta) return undefined;
    
    // Cache hit
    if (audioUrlCache.current[meta.key]) {
      return audioUrlCache.current[meta.key];
    }
    
    // Try IndexedDB first
    let blob = await loadAudioBlob(meta.key);
    
    // Handle remote URLs if no local blob
    if (!blob && (meta.downloadUrl || meta.key.startsWith('http'))) {
      const direct = meta.downloadUrl || meta.key;
      try {
        const resp = await fetch(direct, { method: 'GET' });
        if (resp.ok && resp.headers.get('content-type')?.startsWith('audio')) {
          const fetched = await resp.blob();
          // Save offline using key = meta.key
          await saveAudioBlob(meta.key, fetched);
          blob = fetched;
        } else {
          // If we can't download (CORS or 403), use direct link without caching
          audioUrlCache.current[meta.key] = direct;
          return direct;
        }
      } catch {
        audioUrlCache.current[meta.key] = direct;
        return direct;
      }
    }
    
    // Firebase Storage fallback
    if (!blob && meta.remotePath) {
      try {
        // This would require Firebase Storage ref, handled in CloudContext
        console.warn('[getAudioObjectUrl] Firebase Storage download not handled in service layer');
      } catch (e) {
        console.warn('[getAudioObjectUrl] falha download remoto', meta.remotePath, e);
      }
    }
    
    if (!blob) return undefined;
    
    const url = URL.createObjectURL(blob);
    audioUrlCache.current[meta.key] = url;
    return url;
  }, [loadAudioBlob, saveAudioBlob]);

  const clearAudioCache = useCallback(() => {
    // Clean up object URLs to prevent memory leaks
    Object.values(audioUrlCache.current).forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    audioUrlCache.current = {};
  }, []);

  return {
    saveAudioBlob,
    loadAudioBlob,
    deleteAudioBlob,
    getAudioObjectUrl,
    clearAudioCache
  };
};
