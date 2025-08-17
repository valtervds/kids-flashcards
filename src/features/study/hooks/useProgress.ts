import { useState, useEffect, useCallback } from 'react';
import { ProgressMap } from '../../../domain/models';

export function useProgress() {
  const loadProgress = (): ProgressMap => { try { const raw = localStorage.getItem('deck.progress'); if (raw) return JSON.parse(raw); } catch { /* ignore */ } return {}; };
  const [progress, setProgress] = useState<ProgressMap>(loadProgress);
  useEffect(() => { try { localStorage.setItem('deck.progress', JSON.stringify(progress)); } catch { /* ignore */ } }, [progress]);
  return { progress, setProgress };
}
