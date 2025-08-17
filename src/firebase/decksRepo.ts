import { collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, setDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export interface DeckCard { id?: string; question: string; answers: string[]; }
export interface DeckDoc { id?: string; ownerId: string; name: string; active: boolean; published: boolean; version: number; cards: DeckCard[]; audioMeta?: any; createdAt?: any; updatedAt?: any; }

// Realtime listener for published decks only. Includes defensive error handling and
// a lightweight polling fallback if the realtime channel fails (e.g. rules misconfigured -> 400 Listen errors).
export const listenPublishedDecks = (db: Firestore, cb: (decks: DeckDoc[]) => void, onError?: (err: any) => void) => {
  const ref = query(collection(db, 'decks'), where('published', '==', true));
  let pollTimer: any = null;
  const startPollFallback = () => {
    if (pollTimer) return; // already polling
    // Poll every 30s as a minimal fallback (could be tuned / exponential backoff)
    const run = async () => {
      try {
        const snap = await getDocs(ref);
        const list: DeckDoc[] = [];
        snap.forEach(d => { const data = d.data() as any; list.push({ id: d.id, ...data }); });
        cb(list.sort((a,b)=> a.name.localeCompare(b.name)));
      } catch (e) { onError && onError(e); }
    };
    run();
    pollTimer = setInterval(run, 30000);
  };
  const unsub = onSnapshot(ref, snap => {
    const list: DeckDoc[] = [];
    snap.forEach(d => { const data = d.data() as any; list.push({ id: d.id, ...data }); });
    cb(list.sort((a,b)=> a.name.localeCompare(b.name)));
  }, err => {
    onError && onError(err);
    // Firestore will internally retry; we also start a polling fallback to at least surface data if readable.
    startPollFallback();
  });
  return () => { unsub(); if (pollTimer) clearInterval(pollTimer); };
};

export const createDeck = async (db: Firestore, deck: Omit<DeckDoc,'id'|'version'|'createdAt'|'updatedAt'>) => {
  const ref = await addDoc(collection(db, 'decks'), { ...deck, version: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
};

export const updateDeckDoc = async (db: Firestore, id: string, partial: Partial<DeckDoc>) => {
  const ref = doc(db, 'decks', id);
  await setDoc(ref, { ...partial, updatedAt: serverTimestamp(), ...(partial.cards? { version: (partial as any).version || Date.now() } : {}) }, { merge: true });
};

export const deleteDeckDoc = async (db: Firestore, id: string) => {
  const ref = doc(db, 'decks', id);
  await deleteDoc(ref);
};
