// Simple Firebase Firestore based sync for decks, stats and progress.
// User provides an UID/token manually (no auth flow implemented here) to segregate data.
// Data model:
// collection users/{userId}/flashcards/doc single: { decks: Deck[], stats: Record<string,DeckStats>, progress: ProgressMap, updatedAt }
// Audio blobs are large; for now we only sync deck metadata (audio meta) but NOT the actual audio blob.
// We later can add upload to Firebase Storage if needed.

import { initializeApp, type FirebaseApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

export interface CloudConfig { apiKey: string; authDomain: string; projectId: string; }
export interface CloudBundle { decks: any; stats: any; progress: any; updatedAt: number; }

let app: FirebaseApp | null = null;

export const initFirebase = (cfg: CloudConfig) => {
  if (!app) {
    // Reaproveita app existente se já houver (evita erro app/duplicate-app em conjunto com novo fluxo Firebase)
    const apps = getApps();
    if (apps.length) {
      try { app = getApp(); } catch { app = initializeApp(cfg); }
    } else {
      app = initializeApp(cfg);
    }
  }
  return getFirestore(app);
};

export const loadCloud = async (db: ReturnType<typeof getFirestore>, userId: string): Promise<CloudBundle | null> => {
  try {
    const ref = doc(db, 'users', userId, 'flashcards', 'data');
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as CloudBundle;
  } catch (e) {
    console.warn('loadCloud error', e);
    return null;
  }
};

export const saveCloud = async (db: ReturnType<typeof getFirestore>, userId: string, bundle: CloudBundle) => {
  try {
    const ref = doc(db, 'users', userId, 'flashcards', 'data');
    await setDoc(ref, { ...bundle, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.warn('saveCloud error', e);
  }
};
