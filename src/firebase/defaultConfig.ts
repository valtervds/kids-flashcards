// Firebase default (public) configuration embedded to avoid per-device manual .env setup.
// Not secret; security comes from Firestore/Storage rules.
// Environment variables VITE_FB_* still override if present.
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC-P1Q2AmveuG2o2vFjvzpU8msw_7Gq_Pc',
  authDomain: 'flashcards-d5e0e.firebaseapp.com',
  projectId: 'flashcards-d5e0e',
  storageBucket: 'flashcards-d5e0e.appspot.com',
  messagingSenderId: '96864547605',
  appId: '1:96864547605:web:d19a8dbcf0b8036f15ef1c'
};

export const resolveFirebaseConfig = () => {
  const winAny: any = (typeof window !== 'undefined') ? window : {};
  const vite = winAny.__VITE_ENV__ || {};
  const proc: any = (typeof process !== 'undefined') ? process : {};
  return {
    apiKey: vite.VITE_FB_API_KEY || proc.env?.VITE_FB_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: vite.VITE_FB_AUTH_DOMAIN || proc.env?.VITE_FB_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
    projectId: vite.VITE_FB_PROJECT_ID || proc.env?.VITE_FB_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
    storageBucket: vite.VITE_FB_STORAGE_BUCKET || proc.env?.VITE_FB_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
  appId: vite.VITE_FB_APP_ID || proc.env?.VITE_FB_APP_ID || (DEFAULT_FIREBASE_CONFIG as any).appId,
  messagingSenderId: vite.VITE_FB_MESSAGING_SENDER_ID || proc.env?.VITE_FB_MESSAGING_SENDER_ID || (DEFAULT_FIREBASE_CONFIG as any).messagingSenderId,
  };
};
