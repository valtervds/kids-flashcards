import { collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export interface DeckCard { id?: string; question: string; answers: string[]; }
export interface DeckDoc { id?: string; ownerId: string; name: string; active: boolean; published: boolean; version: number; cards: DeckCard[]; audioMeta?: any; createdAt?: any; updatedAt?: any; }

export const listenPublishedDecks = (db: Firestore, cb: (decks: DeckDoc[]) => void) => {
  const ref = collection(db, 'decks');
  return onSnapshot(ref, snap => {
    const list: DeckDoc[] = [];
    snap.forEach(d => { const data = d.data() as any; if (data.published) list.push({ id: d.id, ...data }); });
    cb(list.sort((a,b)=> a.name.localeCompare(b.name)));
  });
};

export const createDeck = async (db: Firestore, deck: Omit<DeckDoc,'id'|'version'|'createdAt'|'updatedAt'>) => {
  const ref = await addDoc(collection(db, 'decks'), { ...deck, version: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
};

export const updateDeckDoc = async (db: Firestore, id: string, partial: Partial<DeckDoc>) => {
  const ref = doc(db, 'decks', id);
  await setDoc(ref, { ...partial, updatedAt: serverTimestamp(), ...(partial.cards? { version: (partial as any).version || Date.now() } : {}) }, { merge: true });
};
