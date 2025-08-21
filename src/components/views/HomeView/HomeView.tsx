import React from 'react';
import type { Deck, DeckVideoMeta, DeckStats } from '../../../domain/models';
import { useDeckContext } from '../../../contexts/DeckContext';
import { useCloudContext } from '../../../contexts/CloudContext';

interface HomeViewProps {
  stats: Record<string, DeckStats>;
  setCurrentDeckId: (id: string) => void;
  setIndice: (index: number) => void;
  setView: (view: 'home' | 'study' | 'settings' | 'decks') => void;
  setRespostaEntrada: (resposta: string) => void;
  setOrigemUltimaEntrada: (origem: any) => void;
  setMostrarRespostaCorreta: (mostrar: boolean) => void;
  setRevelarQtde: (qtde: number) => void;
  setPreviewVideo: (video: DeckVideoMeta | null) => void;
}

interface DeckAudioInlineProps {
  meta: any;
}

const DeckAudioInline: React.FC<DeckAudioInlineProps> = ({ meta }) => {
  return (
    <div className="caption" style={{ color: '#7ccfff' }}>
      🎵 Áudio: {meta.name}
    </div>
  );
};

export const HomeView: React.FC<HomeViewProps> = ({
  stats,
  setCurrentDeckId,
  setIndice,
  setView,
  setRespostaEntrada,
  setOrigemUltimaEntrada,
  setMostrarRespostaCorreta,
  setRevelarQtde,
  setPreviewVideo
}) => {
  const { decks } = useDeckContext();
  const { firebaseEnabled, cloudDecks } = useCloudContext();
  
  // Filtrar apenas decks ativos
  const studyDeckSource = decks.filter(d => d.active);
  const list = studyDeckSource.map(d => ({
    id: d.id,
    name: d.name,
    total: d.cards.length,
    active: d.active,
    published: d.published,
    cloudId: (d as any).cloudId
  }));

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  };

  const handleStudyDeck = (deckId: string) => {
    setCurrentDeckId(deckId);
    setIndice(0);
    setView('study');
    setRespostaEntrada('');
    setOrigemUltimaEntrada(null);
    setMostrarRespostaCorreta(false);
    setRevelarQtde(0);
  };

  return (
    <>
      <header className="stack" style={{ gap: 4 }}>
        <h1>Seus Baralhos Locais</h1>
        <div className="subtitle">
          Estude apenas cópias locais. Você pode publicar para backup, mas o estudo sempre usa a versão local.
        </div>
      </header>
      
      <div className="stack" style={{ gap: 16 }}>
        {list.map(d => {
          const st = stats[d.id] || { attempts: 0, correct: 0, sessions: 0 };
          const rate = st.attempts ? Math.round(st.correct / st.attempts * 100) : 0;
          const deckObj = decks.find(x => x.id === d.id);
          
          return (
            <div key={d.id} className="card" style={cardStyle}>
              <div className="card-header inline" style={{ justifyContent: 'space-between' }}>
                <span>
                  {d.name}{' '}
                  {d.cloudId && (
                    <span className="badge" style={{ background: '#264d7a' }}>
                      Clonado
                    </span>
                  )}
                </span>
                <span className="badge">{d.total} cartas</span>
              </div>
              
              <div className="caption">
                Tentativas: {st.attempts} · Acertos: {st.correct} · Taxa: {rate}% · Sessões: {st.sessions}
              </div>
              
              {d.published && (
                <div className="caption" style={{ color: '#7ccfff' }}>
                  Publicado
                </div>
              )}
              
              {!d.published && firebaseEnabled && cloudDecks.length === 0 && (
                <div className="caption" style={{ color: '#ffa947' }}>
                  Ainda não publicado
                </div>
              )}
              
              {deckObj?.audio && <DeckAudioInline meta={deckObj.audio} />}
              
              <div className="inline" style={{ gap: 6, flexWrap: 'wrap' }}>
                {deckObj?.video && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    aria-label="Ver vídeo"
                    title="Ver vídeo"
                    onClick={() => setPreviewVideo(deckObj.video!)}
                    style={{ fontSize: 18, lineHeight: 1 }}
                  >
                    🎬
                  </button>
                )}
              </div>
              
              <div className="actions-row" style={{ marginTop: 4 }}>
                <button 
                  className="btn" 
                  type="button" 
                  onClick={() => handleStudyDeck(d.id)}
                >
                  Estudar
                </button>
              </div>
            </div>
          );
        })}
        
        {list.length === 0 && (
          <div className="caption">
            Nenhum baralho ativo. Vá em "Baralhos" para criar ou importar.
          </div>
        )}
      </div>
    </>
  );
};
