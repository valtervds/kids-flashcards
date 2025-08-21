import { useEffect, useRef, useState } from 'react';
import { resolveFirebaseConfig } from '../../firebase/defaultConfig';

/**
 * Firebase utilities and environment helpers
 */
export const useFirebaseConfig = () => {
  const safeEnv = (k: string) => {
    const winAny: any = (typeof window !== 'undefined') ? window : {};
    const vite = winAny.__VITE_ENV__ || {}; // possibilidade de injetar manualmente em index.html se quiser
    const proc: any = (typeof process !== 'undefined') ? process : {};
    return vite[k] || proc.env?.[k] || undefined;
  };

  const firebaseEnv = resolveFirebaseConfig();
  const firebaseAvailable = !!firebaseEnv.apiKey && process.env.NODE_ENV !== 'test';
  
  // Expor config para debug (somente leitura)
  if (typeof window !== 'undefined') {
    (window as any).__FB_CFG = firebaseEnv;
  }

  return {
    firebaseEnv,
    firebaseAvailable,
    safeEnv
  };
};

/**
 * Hook for Firebase initialization and state management
 */
export const useFirebaseState = () => {
  const [firebaseEnabled, setFirebaseEnabled] = useState(process.env.NODE_ENV !== 'test');
  const [firebaseStatus, setFirebaseStatus] = useState('');
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [firebaseInitDelay, setFirebaseInitDelay] = useState(false);
  
  const cloudDbRef = useRef<any>(null);
  const cloudStorageRef = useRef<any>(null);

  const forceFirebaseInit = () => {
    setFirebaseEnabled(false);
    setTimeout(() => setFirebaseEnabled(true), 100);
  };

  return {
    firebaseEnabled,
    setFirebaseEnabled,
    firebaseStatus,
    setFirebaseStatus,
    firebaseUid,
    setFirebaseUid,
    firebaseInitDelay,
    setFirebaseInitDelay,
    cloudDbRef,
    cloudStorageRef,
    forceFirebaseInit
  };
};

/**
 * Utility functions for Firebase operations
 */
export const firebaseUtils = {
  /**
   * Maps cloud deck data to local deck format
   */
  mapCloudDecksToLocal: (list: any[]) => {
    return list.map((d: any) => ({
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
  }
};
