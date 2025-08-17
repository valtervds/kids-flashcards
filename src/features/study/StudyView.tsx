import React from 'react';
import { gerarDica, obterRespostaCorretaPreferida } from '../../utils/scoring';
import { Deck } from '../../domain/models';

interface Props {
  perguntas: string[];
  indice: number;
  setIndice: (n: number) => void;
  respostaEntrada: string;
  setRespostaEntrada: (v: string) => void;
  origemUltimaEntrada: 'voz' | 'manual' | null;
  setOrigemUltimaEntrada: (o: 'voz' | 'manual' | null) => void;
  autoAvaliarVoz: boolean;
  setAutoAvaliarVoz: (b: boolean) => void;
  revelarQtde: number;
  setRevelarQtde: (fn: (r:number)=>number) => void;
  mostrarRespostaCorreta: boolean;
  setMostrarRespostaCorreta: (b:boolean)=>void;
  submeter: (origem: 'voz' | 'manual') => void;
  proximaPergunta: () => void;
  gerarAudioTTS: React.ReactNode;
  usandoDeckImportado: boolean;
  getCurrentDeck: () => Deck | null;
  resultado: any;
  mostrarHistorico: boolean;
  setMostrarHistorico: (f:(b:boolean)=>boolean | boolean)=>void;
  progress: any;
  currentDeckId: string;
  respostasCorretas: Record<number,string[]>;
  deckKeyForHistory: string;
  obterRespostaCorreta: (indice:number)=>string;
  gerarDicaComputed: (indice:number)=>string;
  loadingDeck: boolean;
}

export const StudyView: React.FC<Props> = (props) => {
  const {
    perguntas, indice, respostaEntrada, setRespostaEntrada, origemUltimaEntrada, setOrigemUltimaEntrada,
    autoAvaliarVoz, setAutoAvaliarVoz, revelarQtde, setRevelarQtde, mostrarRespostaCorreta,
    setMostrarRespostaCorreta, submeter, proximaPergunta, gerarAudioTTS, usandoDeckImportado, getCurrentDeck,
    resultado, mostrarHistorico, setMostrarHistorico, progress, deckKeyForHistory, obterRespostaCorreta, gerarDicaComputed, loadingDeck
  } = props;

  if (loadingDeck) {
    return <section className="card" style={{ padding:20 }}><h2>Carregando baralho…</h2><div className="caption">Aguardando dados do servidor.</div></section>;
  }
  if (!perguntas.length) {
    return <section className="card" style={{ padding:20 }}><h2>Nenhuma pergunta</h2><div className="caption">Este baralho não possui cartas ou falhou ao carregar. Volte e escolha outro.</div></section>;
  }
  return (
    <>
      <header className="stack" style={{ gap: 4 }}>
        <h1>Kids Flashcards</h1>
        <div className="subtitle">Pratique e aprenda de forma interativa</div>
      </header>
      <section className="card stack" style={{ gap: 12 }}>
        <div className="card-header inline" style={{ justifyContent:'space-between', alignItems:'center', gap:12 }}>
          <span>Pergunta</span>
          {gerarAudioTTS}
        </div>
        <div className="question-text">{perguntas[indice]}</div>
        {usandoDeckImportado && (
          <div className="caption">{getCurrentDeck()!.name} • Cartão {indice + 1}/{perguntas.length}</div>
        )}
      </section>
      <section className="card stack" style={{ gap: 14 }}>
        <div className="card-header inline" style={{ justifyContent: 'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <span>Resposta</span>
          <label className="inline" style={{ fontWeight: 400 }}>
            <input type="checkbox" checked={autoAvaliarVoz} onChange={e => setAutoAvaliarVoz(e.target.checked)} /> <span className="caption">Auto avaliar voz</span>
          </label>
        </div>
        {/* Campo resposta e ações de voz serão injetados externamente em refactor futuro */}
      </section>
      {resultado && (
        <section className="card stack" style={{ gap: 10 }}>
          <div className="card-header">Resultado</div>
          <div className="caption">Pergunta {indice + 1}/{perguntas.length}</div>
        </section>
      )}
    </>
  );
};
