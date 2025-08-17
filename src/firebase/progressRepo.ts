import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export interface RemoteProgressPerCard { [cardIndex: string]: { scores: number[]; attempts: number; correct: number; } }
export interface RemoteProgressDoc { perCard: RemoteProgressPerCard; attemptsTotal: number; correctTotal: number; sessions: number; deckVersion?: number; updatedAt?: any; }

export const progressDocRef = (db: Firestore, userId: string, deckId: string) => doc(db, 'users', userId, 'progress', deckId);

export const listenProgress = (db: Firestore, userId: string, deckId: string, cb: (data: RemoteProgressDoc) => void) => {
  const ref = progressDocRef(db, userId, deckId);
  return onSnapshot(ref, snap => {
    if (!snap.exists()) return cb({ perCard:{}, attemptsTotal:0, correctTotal:0, sessions:0 });
    cb(snap.data() as RemoteProgressDoc);
  });
};

export const ensureProgressDoc = async (db: Firestore, userId: string, deckId: string) => {
  const ref = progressDocRef(db, userId, deckId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const base: RemoteProgressDoc = { perCard:{}, attemptsTotal:0, correctTotal:0, sessions:0, updatedAt: serverTimestamp() };
    await setDoc(ref, base);
    return base;
  }
  return snap.data() as RemoteProgressDoc;
};

export const updateProgress = async (db: Firestore, userId: string, deckId: string, updater: (cur: RemoteProgressDoc) => RemoteProgressDoc) => {
  const ref = progressDocRef(db, userId, deckId);
  const cur = await ensureProgressDoc(db, userId, deckId);
  const next = updater(cur);
  await setDoc(ref, { ...next, updatedAt: serverTimestamp() });
};
