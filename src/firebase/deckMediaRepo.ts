import { collection, addDoc, doc, setDoc, getDocs, query, where, deleteDoc, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export interface DeckMediaDoc { id?: string; deckId: string; ownerId: string; kind: 'audio' | 'video'; url: string; contentType?: string; posterUrl?: string; durationSec?: number; createdAt?: any; updatedAt?: any; }

const coll = (db: Firestore) => collection(db, 'deckMedia');

export const createDeckMedia = async (db: Firestore, media: Omit<DeckMediaDoc,'id'|'createdAt'|'updatedAt'>) => {
  const ref = await addDoc(coll(db), { ...media, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
};

export const updateDeckMedia = async (db: Firestore, id: string, partial: Partial<DeckMediaDoc>) => {
  const ref = doc(db, 'deckMedia', id);
  await setDoc(ref, { ...partial, updatedAt: serverTimestamp() }, { merge: true });
};

export const deleteDeckMedia = async (db: Firestore, id: string) => {
  await deleteDoc(doc(db, 'deckMedia', id));
};

export const listDeckMedia = async (db: Firestore, deckId: string) => {
  const q = query(coll(db), where('deckId','==', deckId));
  const snap = await getDocs(q);
  const list: DeckMediaDoc[] = [];
  snap.forEach(d => list.push({ id: d.id, ...(d.data() as any) }));
  return list;
};

export const listDeckMediaByOwner = async (db: Firestore, ownerId: string) => {
  const q = query(coll(db), where('ownerId','==', ownerId));
  const snap = await getDocs(q);
  const list: DeckMediaDoc[] = [];
  snap.forEach(d => list.push({ id: d.id, ...(d.data() as any) }));
  return list;
};
