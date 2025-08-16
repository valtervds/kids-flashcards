import React, { useEffect, useRef, useState } from 'react';

interface MascoteTTSProps { texto: string; }

export const MascoteTTS: React.FC<MascoteTTSProps> = ({ texto }) => {
  const [suportaTTS, setSuportaTTS] = useState<boolean>(false);
  const [falando, setFalando] = useState(false);
  const [vozLista, setVozLista] = useState<SpeechSynthesisVoice[]>([]);
  const [vozId, setVozId] = useState<string | null>(() => (typeof localStorage !== 'undefined' ? localStorage.getItem('ttsVoice') : null));
  const vozRef = useRef<SpeechSynthesisVoice | null>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Inicializa suporte + seleciona voz pt-BR quando disponível
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSuportaTTS(true);
      const coletar = () => {
        const voices = window.speechSynthesis.getVoices();
        if (!voices.length) return false;
        // Ordena priorizando pt-BR, depois outras pt, depois restante
        const ordenadas = [...voices].sort((a, b) => {
          const score = (v: SpeechSynthesisVoice) => /pt-BR/i.test(v.lang) ? 3 : (/pt-PT/i.test(v.lang) ? 2 : (/^pt/i.test(v.lang) ? 1 : 0));
          return score(b) - score(a);
        });
        setVozLista(ordenadas);
        // Seleção persistida
        let alvo = ordenadas.find(v => v.name === vozId) || ordenadas.find(v => /pt-BR/i.test(v.lang)) || ordenadas.find(v => /^pt/i.test(v.lang)) || ordenadas[0];
        vozRef.current = alvo || null;
        if (alvo) {
          console.log('[TTS] Voz ativa:', alvo.name, alvo.lang);
        }
        return true;
      };
      // Múltiplas tentativas (alguns dispositivos carregam tardiamente)
      let tentativas = 0;
      const intervalo = setInterval(() => {
        if (coletar() || tentativas++ > 10) {
          clearInterval(intervalo);
        }
      }, 250);
      window.speechSynthesis.addEventListener('voiceschanged', coletar);
      return () => {
        clearInterval(intervalo);
        window.speechSynthesis.removeEventListener('voiceschanged', coletar);
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

  const alterarVoz = (id: string) => {
    setVozId(id);
    if (typeof localStorage !== 'undefined') localStorage.setItem('ttsVoice', id);
    const encontrada = vozLista.find(v => v.name === id);
    vozRef.current = encontrada || null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 420 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={falar} disabled={!suportaTTS || falando} aria-label="Ouvir pergunta">
          {falando ? 'Falando…' : 'Ouvir pergunta'}
        </button>
        <button onClick={parar} disabled={!falando} aria-label="Parar áudio">Parar</button>
      </div>
      {suportaTTS && vozLista.length > 0 && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <label style={{ fontSize: 12 }}>Voz: </label>
          <select
            value={vozRef.current?.name || ''}
            onChange={(e) => alterarVoz(e.target.value)}
            style={{ flex: 1 }}
            aria-label="Selecionar voz"
          >
            {vozLista.filter(v => /pt/i.test(v.lang)).map(v => (
              <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
            ))}
            {/* fallback - se nenhuma voz pt aparecer, mostrar todas */}
            {vozLista.every(v => !/pt/i.test(v.lang)) && vozLista.map(v => (
              <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (vozRef.current) {
                window.speechSynthesis.cancel();
                const teste = 'Olá! Esta é uma amostra da voz brasileira.';
                const u = new SpeechSynthesisUtterance(teste);
                u.lang = vozRef.current.lang;
                u.voice = vozRef.current;
                window.speechSynthesis.speak(u);
              }
            }}
            style={{ fontSize: 12 }}
          >Teste</button>
        </div>
      )}
      {!suportaTTS && <span style={{ color: 'red' }}>Sem suporte a TTS</span>}
    </div>
  );
};
