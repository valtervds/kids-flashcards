
import React, { useState } from 'react';
import { MascoteTTS } from './components/MascoteTTS';

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

export const App: React.FC = () => {
  const [indice, setIndice] = useState(0);
  const [respostaVoz, setRespostaVoz] = useState<string>('');

  const proximaPergunta = () => {
    setIndice((prev) => (prev + 1) % perguntas.length);
  };

  return (
    <div style={{ padding: 32 }}>
      <h1>Kids Flashcards</h1>
      <MascoteTTS texto={perguntas[indice]} />
      <p>Pergunta: {perguntas[indice]}</p>
      <ReconhecimentoVoz onResultado={(txt) => setRespostaVoz(txt)} />
      {respostaVoz && (
        <div style={{ marginTop: 12 }}>
          <strong>Você disse:</strong> {respostaVoz}
        </div>
      )}
      <button onClick={proximaPergunta} style={{ marginTop: 16 }}>
        Próxima pergunta
      </button>
    </div>
  );
};
