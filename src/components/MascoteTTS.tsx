import React, { useEffect, useRef, useState } from 'react';

interface MascoteTTSProps { texto: string; }

export const MascoteTTS: React.FC<MascoteTTSProps> = ({ texto }) => {
  const [suportaTTS, setSuportaTTS] = useState<boolean>(false);
  const [falando, setFalando] = useState(false);
  const vozRef = useRef<SpeechSynthesisVoice | null>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Inicializa suporte + seleciona voz pt-BR quando disponível
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSuportaTTS(true);
      const selecionarVoz = () => {
        const voices = window.speechSynthesis.getVoices();
        if (!voices.length) return; // ainda carregando
        // Preferências de voz (pt-BR > pt-PT > qualquer pt > default)
        const preferida = voices.find(v => /pt-BR/i.test(v.lang))
          || voices.find(v => /pt-PT/i.test(v.lang))
          || voices.find(v => /^pt/i.test(v.lang))
          || null;
        vozRef.current = preferida;
        if (preferida) {
          console.log('[TTS] Voz selecionada:', preferida.name, preferida.lang);
        } else {
          console.log('[TTS] Nenhuma voz PT encontrada, usando default.');
        }
      };
      selecionarVoz();
      window.speechSynthesis.addEventListener('voiceschanged', selecionarVoz);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', selecionarVoz);
      };
    }
  }, []);

  useEffect(() => {
    // Se pergunta mudou enquanto falava, opcional: interromper
    if (falando) {
      window.speechSynthesis.cancel();
      setFalando(false);
    }
  }, [texto]);

  const tentarFalar = (retry = 0) => {
    try {
      const utter = new SpeechSynthesisUtterance(texto);
      utter.lang = vozRef.current?.lang || 'pt-BR';
      if (vozRef.current) utter.voice = vozRef.current;
      utter.rate = 1; utter.pitch = 1;
      utter.onstart = () => { setFalando(true); console.log('[TTS] onstart'); };
      utter.onend = () => { setFalando(false); console.log('[TTS] onend'); };
      utter.onpause = () => console.log('[TTS] onpause');
      utter.onboundary = (e) => {/* boundary events omitidos para evitar ruido */};
      utter.onerror = (e) => {
        console.warn('[TTS] erro', e.error);
        setFalando(false);
        if (e.error === 'interrupted' && retry < 1) {
          console.log('[TTS] Retentando após interrupted...');
          setTimeout(() => tentarFalar(retry + 1), 120);
        }
      };
      utterRef.current = utter;
      console.log('[TTS] speak() texto="' + texto + '" voz=' + (utter.voice?.name || 'default'));
      window.speechSynthesis.speak(utter);
      // Alguns navegadores "pausam" imediatamente: tentar resumir
      setTimeout(() => { if (window.speechSynthesis.paused) { console.log('[TTS] resume() automático'); window.speechSynthesis.resume(); } }, 180);
    } catch (err) {
      console.error('[TTS] Exceção ao falar', err);
      setFalando(false);
    }
  };

  const falar = () => {
    if (!suportaTTS) { alert('Seu navegador não suporta TTS.'); return; }
    // Se já falando esta mesma frase, reinicia
    if (falando) {
      console.log('[TTS] Já falando – reiniciando');
      window.speechSynthesis.cancel();
      setTimeout(() => tentarFalar(), 80);
      return;
    }
    // Se há algo pendente/speaking, cancelar suavemente e depois falar
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      console.log('[TTS] Cancel anterior antes de falar novo');
      window.speechSynthesis.cancel();
      setTimeout(() => tentarFalar(), 80);
    } else {
      tentarFalar();
    }
  };

  const parar = () => {
    if (!suportaTTS) return;
    window.speechSynthesis.cancel();
    setFalando(false);
  };

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={falar} disabled={!suportaTTS || falando} aria-label="Ouvir pergunta">
        {falando ? 'Falando…' : 'Ouvir pergunta'}
      </button>
      <button onClick={parar} disabled={!falando} aria-label="Parar áudio">Parar</button>
      {!suportaTTS && <span style={{ color: 'red' }}>Sem suporte a TTS</span>}
    </div>
  );
};
