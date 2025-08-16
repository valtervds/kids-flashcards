
import React, { useState, useEffect, useRef } from 'react';
import { MascoteTTS } from './components/MascoteTTS';
import { Stars } from './components/Stars';
import { avaliar } from './evaluation';

// Tipo de janela para TS (extensões Web Speech API)
declare global {
  interface Window {
    webkitSpeechRecognition?: any;
  }
}

interface ReconhecimentoProps {
  onResultado: (texto: string) => void;
}

const ReconhecimentoVoz: React.FC<ReconhecimentoProps> = ({ onResultado }) => {
  const [suporte, setSuporte] = useState<boolean>(() => typeof window !== 'undefined' && (!!(window as any).SpeechRecognition || !!window.webkitSpeechRecognition));
  const [gravando, setGravando] = useState(false);
  const [transcricao, setTranscricao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const reconhecimentoRef = React.useRef<any | null>(null);

  const iniciar = () => {
    if (!suporte) return;
    setErro(null);
  const SR: any = (window as any).SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSuporte(false); return; }
    const instancia = new SR();
    reconhecimentoRef.current = instancia;
    instancia.lang = 'pt-BR';
    instancia.continuous = false; // curta frase
    instancia.interimResults = true; // mostrar parcial
    instancia.maxAlternatives = 1;
    instancia.onstart = () => { setGravando(true); setTranscricao(''); };
    instancia.onerror = (e: any) => { console.warn('[ASR] erro', e.error); setErro(e.error); setGravando(false); };
    instancia.onresult = (e: any) => {
      let finalTexto = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalTexto += res[0].transcript;
        else finalTexto += res[0].transcript; // interim
      }
      setTranscricao(finalTexto);
    };
    instancia.onend = () => {
      setGravando(false);
      if (transcricao.trim()) onResultado(transcricao.trim());
    };
    try {
      instancia.start();
    } catch (err) {
      console.error('[ASR] start exception', err);
    }
  };

  const parar = () => {
    reconhecimentoRef.current?.stop();
  };

  return (
    <div style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8, maxWidth: 420 }}>
      <strong>Responder por voz</strong><br />
      {!suporte && <div style={{ color: 'red' }}>Navegador sem suporte a reconhecimento de voz.</div>}
      {suporte && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={iniciar} disabled={gravando}>🎤 {gravando ? 'Gravando...' : 'Falar'}</button>
          <button onClick={parar} disabled={!gravando}>Parar</button>
        </div>
      )}
      <div style={{ marginTop: 8, minHeight: 24, fontFamily: 'monospace', background: '#f7f7f7', padding: 6, borderRadius: 4 }}>
        {transcricao ? transcricao : (gravando ? 'Capturando...' : 'Sem transcrição ainda')}
      </div>
      {erro && <div style={{ color: 'tomato', marginTop: 4 }}>Erro: {erro}</div>}
      <small style={{ display: 'block', marginTop: 6, color: '#666' }}>Dica: fale claramente e clique Parar ao terminar.</small>
    </div>
  );
};

const perguntas = [
  'Qual é a capital do Brasil?',
  'Quantos dias tem uma semana?',
  'O que é um flashcard?'
];

// (agora respostasCorretas/normalização centralizadas em evaluation.ts)

export const App: React.FC = () => {
  const [indice, setIndice] = useState(0);
  const [respostaVoz, setRespostaVoz] = useState<string>('');
  const [respostaManual, setRespostaManual] = useState('');
  const [resultado, setResultado] = useState<null | { correto: boolean; score: number; detalhes: string }>(null);
  const [autoAvaliarVoz, setAutoAvaliarVoz] = useState(true);
  const audioOkRef = useRef<HTMLAudioElement | null>(null);
  const audioErroRef = useRef<HTMLAudioElement | null>(null);
  const [inicioPerguntaTs, setInicioPerguntaTs] = useState<number>(() => Date.now());
  const [ultimoTempoRespostaMs, setUltimoTempoRespostaMs] = useState<number | null>(null);

  useEffect(() => {
    // Tenta carregar arquivos reais; fallback para beeps embutidos
    const ok = new Audio('/sounds/success.mp3');
    const err = new Audio('/sounds/error.mp3');
    ok.onerror = () => {
      ok.src = 'data:audio/wav;base64,UklGRuwAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YbAAAACAgICAgP8AAP//AAAA';
    };
    err.onerror = () => {
      err.src = 'data:audio/wav;base64,UklGRuwAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YaAAAAD///8AAAD/AAD//wAA';
    };
    audioOkRef.current = ok;
    audioErroRef.current = err;
  }, []);

  const submeter = (origem: 'voz' | 'manual') => {
    const valor = origem === 'voz' ? respostaVoz : respostaManual;
    if (!valor.trim()) return;
    const res = avaliar(indice, valor);
    setResultado(res);
  setUltimoTempoRespostaMs(Date.now() - inicioPerguntaTs);
    if (res.correto) audioOkRef.current?.play(); else audioErroRef.current?.play();
  };

  const proximaPergunta = () => {
    setIndice((prev) => (prev + 1) % perguntas.length);
    // reset estados relacionados à resposta
    setRespostaVoz('');
    setRespostaManual('');
    setResultado(null);
  setInicioPerguntaTs(Date.now());
  };

  // Auto-avaliar quando voz chega se toggle ligado
  useEffect(() => {
    if (autoAvaliarVoz && respostaVoz.trim()) {
      submeter('voz');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respostaVoz]);

  return (
    <div style={{ padding: 32 }}>
      <h1>Kids Flashcards</h1>
      <MascoteTTS texto={perguntas[indice]} />
      <p>Pergunta: {perguntas[indice]}</p>
      {process.env.NODE_ENV === 'test' && (
        <div style={{ marginBottom: 8 }}>
          <button data-testid="simular-voz" onClick={() => setRespostaVoz('Brasília')}>Simular Voz</button>
        </div>
      )}
      <ReconhecimentoVoz onResultado={(txt) => setRespostaVoz(txt)} />
      {respostaVoz && (
        <div style={{ marginTop: 12 }}>
          <strong>Você disse:</strong> {respostaVoz}
          {!autoAvaliarVoz && (
            <div>
              <button style={{ marginTop: 4 }} onClick={() => submeter('voz')}>Avaliar resposta de voz</button>
            </div>
          )}
        </div>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <input type="checkbox" checked={autoAvaliarVoz} onChange={(e) => setAutoAvaliarVoz(e.target.checked)} />
        Auto avaliar resposta de voz
      </label>
      <div style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8, maxWidth: 420 }}>
        <strong>Responder digitando</strong>
        <form onSubmit={(e) => { e.preventDefault(); submeter('manual'); }} style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={respostaManual}
            onChange={e => setRespostaManual(e.target.value)}
            placeholder="Digite sua resposta"
            style={{ flex: 1 }}
            aria-label="Resposta manual"
          />
          <button type="submit">Enviar</button>
        </form>
      </div>
      {resultado && (
        <div style={{ marginTop: 16 }}>
          <Stars score={resultado.correto ? 5 : resultado.score} animated />
          <div style={{ marginTop: 8, fontWeight: 'bold', color: resultado.correto ? 'green' : 'crimson' }}>
            {resultado.correto ? '✅ Correto! 5/5 estrelas.' : `❌ Ainda não. Score: ${resultado.score}/5 (${resultado.detalhes}).`}
          </div>
          {ultimoTempoRespostaMs != null && (
            <div style={{ marginTop: 4, fontSize: 12, color: '#555' }}>
              Tempo de resposta: {ultimoTempoRespostaMs} ms
            </div>
          )}
        </div>
      )}
      <button onClick={proximaPergunta} style={{ marginTop: 16 }}>
        Próxima pergunta
      </button>
    </div>
  );
};
