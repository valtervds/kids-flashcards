import React from 'react';
import { gerarDica, obterRespostaCorretaPreferida } from '../../utils/scoring';
import { Deck } from '../../domain/models';
import { Stars } from '../../components/Stars';
import { MascoteTTS } from '../../components/MascoteTTS';

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
  obterRespostasTodas?: (indice:number)=>string[];
  loadingDeck: boolean;
  ultimoTempoRespostaMs?: number | null;
  onSimularVoz?: (texto:string)=>void;
  onSubmeterManual?: ()=>void;
  onRespostaVoz?: (texto:string, final:boolean)=>void;
  ReconhecimentoVozSlot?: React.ReactNode; // permite injeção futura
}

export const StudyView: React.FC<Props> = (props) => {
  const {
    perguntas, indice, respostaEntrada, setRespostaEntrada, origemUltimaEntrada, setOrigemUltimaEntrada,
    autoAvaliarVoz, setAutoAvaliarVoz, revelarQtde, setRevelarQtde, mostrarRespostaCorreta,
    setMostrarRespostaCorreta, submeter, proximaPergunta, gerarAudioTTS, usandoDeckImportado, getCurrentDeck,
  resultado, mostrarHistorico, setMostrarHistorico, progress, deckKeyForHistory, obterRespostaCorreta, gerarDicaComputed, loadingDeck,
  obterRespostasTodas,
    ultimoTempoRespostaMs, onSimularVoz, onSubmeterManual, ReconhecimentoVozSlot
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
          {gerarAudioTTS || <MascoteTTS texto={perguntas[indice]} showVoiceSelector={false} />}
        </div>
        <div className="question-text">{perguntas[indice]}</div>
        {process.env.NODE_ENV === 'test' && onSimularVoz && (
          <button data-testid="simular-voz" className="btn btn-ghost" type="button" onClick={() => onSimularVoz('Brasília')}>Simular Voz</button>
        )}
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
        <form className="stack" style={{ gap:8 }} onSubmit={(e)=> { e.preventDefault(); onSubmeterManual ? onSubmeterManual() : submeter('manual'); }}>
          <div className="inline" style={{ gap:8, alignItems:'stretch' }}>
            <input type="text" value={respostaEntrada} onChange={e => { setRespostaEntrada(e.target.value); setOrigemUltimaEntrada('manual'); }} placeholder="Digite ou use o microfone" aria-label="Campo de resposta" style={{ flex:1 }} />
            {ReconhecimentoVozSlot}
            <button className="btn" type="submit">Enviar</button>
          </div>
          {origemUltimaEntrada==='voz' && respostaEntrada && !autoAvaliarVoz && (
            <div className="actions-row">
              <button className="btn" type="button" onClick={() => submeter('voz')}>Avaliar voz</button>
            </div>
          )}
        </form>
        <div className="actions-row" style={{ marginTop:4 }}>
          <button className="btn btn-secondary" type="button" onClick={() => setRevelarQtde(r => r + 1)} disabled={mostrarRespostaCorreta}>Dica</button>
          <button className="btn btn-ghost" type="button" onClick={() => setMostrarRespostaCorreta(true)} disabled={mostrarRespostaCorreta}>Mostrar resposta</button>
          <button className="btn" type="button" onClick={proximaPergunta}>Próxima pergunta</button>
        </div>
        {revelarQtde > 0 && !mostrarRespostaCorreta && (
          <div className="hint-box">Dica: {gerarDicaComputed(indice)}</div>
        )}
        {mostrarRespostaCorreta && (
          <div className="answer-box">
            Resposta correta: <strong>{obterRespostaCorreta(indice)}</strong>
            {obterRespostasTodas && (() => {
              const todas = obterRespostasTodas(indice) || [];
              if (todas.length <= 1) return null;
              return <div style={{ marginTop:6, fontSize:12 }}>Todas as respostas aceitas: {todas.join(', ')}</div>;
            })()}
          </div>
        )}
      </section>
      {resultado && (
        <section className="card stack" style={{ gap: 10 }}>
          <div className="card-header">Resultado</div>
          <Stars score={resultado.correto ? 5 : resultado.score} animated />
          <div className={`result ${resultado.correto ? 'success' : 'error'}`}>
            {resultado.correto ? '✅ Correto! 5/5 estrelas.' : `❌ Ainda não. Score: ${resultado.score}/5 (${resultado.detalhes}).`}
          </div>
          <div className="caption">
            {ultimoTempoRespostaMs != null && <>Tempo: {ultimoTempoRespostaMs} ms | </>}Pergunta {indice + 1}/{perguntas.length}
          </div>
          <div className="actions-row" style={{ justifyContent:'flex-start' }}>
            <button className="btn btn-secondary" type="button" onClick={()=> setMostrarHistorico(m => !(typeof m==='boolean'? m : false))}>{mostrarHistorico ? 'Ocultar histórico' : 'Histórico'}</button>
          </div>
          {mostrarHistorico && (() => {
            const arr = (progress[deckKeyForHistory]?.[indice]) || [];
            const media = arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2) : '-';
            return (
              <div className="answer-box" style={{ maxHeight:140, overflow:'auto', fontSize:12 }}>
                <strong>Histórico ({arr.length})</strong><br/>
                Média: {media} • Últimos: {arr.slice(-10).join(', ') || '—'}
              </div>
            );
          })()}
        </section>
      )}
      {!resultado && (
        <div className="inline" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" type="button" onClick={proximaPergunta}>Próxima pergunta</button>
        </div>
      )}
    </>
  );
};
