import { useState } from 'react';

export function useStudySession(perguntas: string[]) {
  const [indice, setIndice] = useState(0);
  const proxima = () => setIndice(p => (perguntas.length ? (p + 1) % perguntas.length : 0));
  return { indice, setIndice, proxima };
}
