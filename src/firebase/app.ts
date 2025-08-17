import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

export interface FirebaseEnvConfig { apiKey:string; authDomain:string; projectId:string; storageBucket?: string; appId?:string; }

let inited = false;
let firestoreInstance: ReturnType<typeof getFirestore> | null = null;
let authInstance: ReturnType<typeof getAuth> | null = null;
let storageInstance: ReturnType<typeof getStorage> | null = null;

export const initFirebaseApp = async (cfg: FirebaseEnvConfig) => {
  if (inited) return { db: firestoreInstance!, auth: authInstance!, storage: storageInstance! };
  const app = initializeApp(cfg);
  const db = getFirestore(app);
  try { await enableIndexedDbPersistence(db); } catch {/* ignore offline if unsupported */}
  const auth = getAuth(app);
  const storage = getStorage(app);
  inited = true; firestoreInstance = db; authInstance = auth; storageInstance = storage;
  return { db, auth, storage };
};

export const ensureAnonymousAuth = (auth = authInstance) => new Promise<string>((resolve, reject) => {
  if (!auth) return reject('Auth not initialized');
  if (auth.currentUser) return resolve(auth.currentUser.uid);
  const unsub = onAuthStateChanged(auth, u => { if (u) { unsub(); resolve(u.uid); } });
  signInAnonymously(auth).catch(err => { console.warn('anon sign-in error', err); reject(err); });
});
