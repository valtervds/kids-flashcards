import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { FirebaseStorage } from 'firebase/storage';

export const uploadDeckAudio = async (storage: FirebaseStorage, deckId: string, file: File | Blob, fileName: string) => {
  const path = `deck-audio/${deckId}/main-${Date.now()}-${fileName}`;
  const r = ref(storage, path);
  await uploadBytes(r, file);
  const url = await getDownloadURL(r);
  return { storagePath: path, url };
};
