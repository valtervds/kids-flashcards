
import React, { useState, useEffect, useRef } from 'react';
import { MascoteTTS } from './components/MascoteTTS';
import { Stars } from './components/Stars';
import { avaliar, respostasCorretas } from './evaluation';

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
    let acumuladoFinal = '';
    instancia.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          acumuladoFinal += res[0].transcript;
        } else {
          // mostra parcial juntando acumulado + atual
          setTranscricao((acumuladoFinal + res[0].transcript).trim());
        }
      }
      // se recebeu final em algum ponto atualiza transcrição completa
      if (acumuladoFinal) setTranscricao(acumuladoFinal.trim());
    };
    instancia.onend = () => {
      setGravando(false);
      const finalStr = (acumuladoFinal || transcricao).trim();
      if (finalStr) onResultado(finalStr);
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

// Funções de apoio para dicas / resposta correta
function obterRespostaCorretaPreferida(idx: number): string {
  const lista = respostasCorretas[idx];
  if (!lista || !lista.length) return '';
  // Escolhe a primeira como canônica
  return lista[0];
}

function gerarDica(idx: number, revelarQtde: number): string {
  const resp = obterRespostaCorretaPreferida(idx);
  if (!resp) return '';
  const limite = Math.min(revelarQtde, resp.length);
  const revelada = resp.slice(0, limite);
  const restante = resp.slice(limite).replace(/./g, '•');
  return revelada + restante;
}

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
  const [mostrarRespostaCorreta, setMostrarRespostaCorreta] = useState(false);
  const [revelarQtde, setRevelarQtde] = useState(0); // letras reveladas na dica
  const [sonsAtivos, setSonsAtivos] = useState(true);
  const [audioPronto, setAudioPronto] = useState(false);

  useEffect(() => {
    // Sons embutidos base64 (curtos). Mantemos como fallback se Web Audio indisponível.
    const SUCCESS_BEEP = 'data:audio/wav;base64,UklGRqgAAABXQVZFZm10IBAAAAABAAEAIlYAACJWAAABAAgAZGF0YYAAAAAAAP8A/wD///8A/wD/AP8A//8A////AP8A/wD///8AAAAA';
    const ERROR_BEEP = 'data:audio/wav;base64,UklGRqgAAABXQVZFZm10IBAAAAABAAEAIlYAACJWAAABAAgAZGF0YQAAAAAA////AP//AP8A//8A////AP8A//8A////AP8A//8A';
    audioOkRef.current = new Audio(SUCCESS_BEEP);
    audioErroRef.current = new Audio(ERROR_BEEP);
  }, []);

  // Controle de primeira interação para evitar bloqueio de autoplay em mobile
  const interagiuRef = useRef(false);
  useEffect(() => {
    const marcar = () => { interagiuRef.current = true; };
    window.addEventListener('pointerdown', marcar, { once: true });
    window.addEventListener('keydown', marcar, { once: true });
    return () => {
      window.removeEventListener('pointerdown', marcar);
      window.removeEventListener('keydown', marcar);
    };
  }, []);

  // Fallback via Web Audio API caso play() rejeite (ex: bloqueio de autoplay)
  // Gera um ou mais tons sucessivos via Web Audio (se disponível)
  const gerarTons = (padrao: number[]) => {
    if (!sonsAtivos) return;
    if (!interagiuRef.current) return; // precisa ter interação antes
    if (typeof window === 'undefined') return;
    const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    try {
      const ctx = new Ctx();
      let t = ctx.currentTime;
      padrao.forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        osc.start(t);
        osc.stop(t + 0.3);
        t += 0.18; // pequeno offset para sequência
      });
      setAudioPronto(true);
    } catch {
      // fallback ignorado
    }
  };

  const safePlay = (tipo: 'ok' | 'erro') => {
    if (!sonsAtivos) return;
    // Primeiro tenta Web Audio (melhor latência). Padrões diferentes:
    if (tipo === 'ok') gerarTons([880, 1320]); else gerarTons([220, 180]);
    // Também dispara <audio> básico como redundância (se permitido)
    const el = tipo === 'ok' ? audioOkRef.current : audioErroRef.current;
    if (!el) return;
    try { el.currentTime = 0; el.play().catch(() => {/* ignorar */}); } catch {/* */}
  };

  const submeter = (origem: 'voz' | 'manual') => {
    const valor = origem === 'voz' ? respostaVoz : respostaManual;
    if (!valor.trim()) return;
    const res = avaliar(indice, valor);
    setResultado(res);
  setUltimoTempoRespostaMs(Date.now() - inicioPerguntaTs);
  if (res.correto) safePlay('ok'); else safePlay('erro');
  };

  const proximaPergunta = () => {
    setIndice((prev) => (prev + 1) % perguntas.length);
    // reset estados relacionados à resposta
    setRespostaVoz('');
    setRespostaManual('');
    setResultado(null);
  setInicioPerguntaTs(Date.now());
  setMostrarRespostaCorreta(false);
  setRevelarQtde(0);
  setUltimoTempoRespostaMs(null);
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
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={sonsAtivos} onChange={e => setSonsAtivos(e.target.checked)} /> Som
        </label>
        <button type="button" onClick={() => { interagiuRef.current = true; safePlay('ok'); }} style={{ fontSize: 12 }}>
          Testar som
        </button>
        {!audioPronto && sonsAtivos && (
          <span style={{ fontSize: 12, color: '#666' }}>Clique em "Testar som" para ativar áudio (mobile).</span>
        )}
      </div>
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button type="button" onClick={() => setRevelarQtde(r => r + 1)} disabled={mostrarRespostaCorreta}>
            Dica
          </button>
          <button type="button" onClick={() => setMostrarRespostaCorreta(true)} disabled={mostrarRespostaCorreta}>
            Mostrar resposta correta
          </button>
        </div>
        {revelarQtde > 0 && !mostrarRespostaCorreta && (
          <div style={{ marginTop: 8, fontSize: 14, background: '#f7f7f7', padding: 6, borderRadius: 4 }}>
            Dica: {gerarDica(indice, revelarQtde)}
          </div>
        )}
        {mostrarRespostaCorreta && (
          <div style={{ marginTop: 8, fontSize: 14, background: '#eef9f1', padding: 6, borderRadius: 4 }}>
            Resposta correta: <strong>{obterRespostaCorretaPreferida(indice)}</strong>
          </div>
        )}
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
          {!resultado.correto && !mostrarRespostaCorreta && (
            <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
              Dica: use o botão "Dica" ou revele a resposta correta para aprender.
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
