import { useEffect, useRef, useState } from 'react';

export function useAudioFeedback(enabled: boolean) {
  const audioOkRef = useRef<HTMLAudioElement | null>(null);
  const audioErroRef = useRef<HTMLAudioElement | null>(null);
  const interagiuRef = useRef(false);
  const [audioPronto, setAudioPronto] = useState(false);

  useEffect(() => {
    const marcar = () => { interagiuRef.current = true; };
    window.addEventListener('pointerdown', marcar, { once: true });
    window.addEventListener('keydown', marcar, { once: true });
    return () => { window.removeEventListener('pointerdown', marcar); window.removeEventListener('keydown', marcar); };
  }, []);

  const gerarTons = (padrao: number[]) => {
    if (!enabled || !interagiuRef.current) return;
    const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    try {
      const ctx = new Ctx(); let t = ctx.currentTime;
      padrao.forEach(freq => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, t);
        osc.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        osc.start(t); osc.stop(t + 0.3); t += 0.18;
      });
      setAudioPronto(true);
    } catch { /* ignore */ }
  };

  const safePlay = (tipo: 'ok' | 'erro') => {
    if (!enabled) return;
    if (tipo === 'ok') gerarTons([880, 1320]); else gerarTons([220, 180]);
    const el = (tipo === 'ok' ? audioOkRef.current : audioErroRef.current);
    try { if (el) { el.currentTime = 0; el.play().catch(()=>{}); } } catch {/* */}
  };

  return { audioOkRef, audioErroRef, safePlay, audioPronto };
}
