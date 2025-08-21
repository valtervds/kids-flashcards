import React, { useState } from 'react';
import type { Deck, DeckStats, DeckAudioMeta, DeckVideoMeta, Flashcard } from '../../../domain/models';
import { useDeckContext } from '../../../contexts/DeckContext';
import { useCloudContext } from '../../../contexts/CloudContext';
import { DeckImport } from '../../DeckImport';
import { DeckAudioPlayer, DeckAudioInline } from '../../media/DeckAudio';
import { DeckVideoPlayer, ManualRemoteVideoInput } from '../../media/DeckVideo';
import { ManualRemoteAudioInput } from '../../media/ManualRemoteAudioInput';

interface DecksViewProps {
  stats: Record<string, DeckStats>;
  setCurrentDeckId: (id: string | null) => void;
  setIndice: (indice: number) => void;
  setView: (view: 'home' | 'study' | 'settings' | 'decks') => void;
  setRespostaEntrada: (resposta: string) => void;
  setOrigemUltimaEntrada: (origem: string) => void;
  setMostrarRespostaCorreta: (mostrar: boolean) => void;
  setRevelarQtde: (qtde: number) => void;
  publishLogs: Record<string, string[]>;
  appendPublishLog: (deckId: string, message: string) => void;
  setPublishLogs: (logs: Record<string, string[]>) => void;
}

export const DecksView: React.FC<DecksViewProps> = ({
  stats,
  setCurrentDeckId,
  setIndice,
  setView,
  setRespostaEntrada,
  setOrigemUltimaEntrada,
  setMostrarRespostaCorreta,
  setRevelarQtde,
  publishLogs,
  appendPublishLog,
  setPublishLogs
}) => {
  const { decks, updateDeck, deleteDeck, addDeck } = useDeckContext();
  const { publishDeckFirebase, deleteDeckDoc } = useCloudContext();

  const [showImport, setShowImport] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState<string | null>(null);

  const handleStudyDeck = (deck: Deck) => {
    setCurrentDeckId(deck.id);
    setIndice(0);
    setRespostaEntrada('');
    setOrigemUltimaEntrada('manual');
    setMostrarRespostaCorreta(false);
    setRevelarQtde(0);
    setView('study');
  };

  const handleDeleteDeck = (deckId: string) => {
    deleteDeck(deckId);
    setDeckToDelete(null);
  };

  const handlePublishDeck = async (deck: Deck) => {
    try {
      appendPublishLog(deck.id, `Publicando deck "${deck.name}"...`);
      await publishDeckFirebase(deck);
      appendPublishLog(deck.id, `Deck "${deck.name}" publicado com sucesso!`);
    } catch (error) {
      appendPublishLog(deck.id, `Erro ao publicar deck "${deck.name}": ${error}`);
    }
  };

  return (
    <div className="stack" style={{ gap: 16, padding: 20 }}>
      <header className="stack" style={{ gap: 4 }}>
        <h1>Gerenciar Baralhos</h1>
        <div className="subtitle">
          Crie, edite e organize seus baralhos de flashcards.
        </div>
      </header>

      <div className="inline" style={{ gap: 12 }}>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowImport(true)}
        >
          Importar Baralho
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={() => {
            const name = prompt('Nome do novo baralho:');
            if (name) {
              addDeck(name, []);
            }
          }}
        >
          Criar Novo
        </button>
      </div>

      {showImport && (
        <div className="stack" style={{ gap: 12, padding: 16, background: 'var(--color-surface)', borderRadius: 8 }}>
          <DeckImport 
            onLoad={(cards) => {
              // Criar um deck com base nas cartas importadas
              const deckName = `Deck Importado ${new Date().toLocaleDateString()}`;
              addDeck(deckName, cards);
              setShowImport(false);
            }}
            hasDeck={false}
            onClear={() => {}}
          />
          <button 
            className="btn btn-ghost" 
            onClick={() => setShowImport(false)}
          >
            Cancelar
          </button>
        </div>
      )}

      {decks.length === 0 ? (
        <div className="caption">
          Nenhum baralho encontrado. Crie ou importe um baralho para começar.
        </div>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {decks.map((deck) => (
            <div 
              key={deck.id} 
              className="stack" 
              style={{ 
                gap: 12, 
                padding: 16, 
                background: 'var(--color-surface)', 
                borderRadius: 8,
                border: '1px solid var(--color-border)'
              }}
            >
              <div className="inline" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>{deck.name}</h3>
                <div className="inline" style={{ gap: 8 }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => handleStudyDeck(deck)}
                  >
                    Estudar
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => handlePublishDeck(deck)}
                  >
                    Publicar
                  </button>
                  <button 
                    className="btn btn-danger" 
                    onClick={() => setDeckToDelete(deck.id)}
                  >
                    Excluir
                  </button>
                </div>
              </div>

              <div className="caption">
                {deck.cards.length} cartões · Criado em {new Date(deck.createdAt).toLocaleDateString()}
              </div>

              {deck.audio && (
                <div className="stack" style={{ gap: 8 }}>
                  <strong style={{ fontSize: 12 }}>Áudio do baralho:</strong>
                  <DeckAudioPlayer 
                    meta={deck.audio} 
                    onRemove={() => updateDeck(deck.id, { audio: undefined })} 
                  />
                </div>
              )}

              {deck.video && (
                <div className="stack" style={{ gap: 8 }}>
                  <strong style={{ fontSize: 12 }}>Vídeo do baralho:</strong>
                  <DeckVideoPlayer 
                    meta={deck.video} 
                    onRemove={() => updateDeck(deck.id, { video: undefined })} 
                  />
                </div>
              )}

              {!deck.audio && (
                <div className="stack" style={{ gap: 8 }}>
                  <strong style={{ fontSize: 12 }}>Adicionar áudio:</strong>
                  <ManualRemoteAudioInput 
                    deck={deck} 
                    onSet={(audio) => updateDeck(deck.id, { audio })} 
                  />
                </div>
              )}

              {!deck.video && (
                <div className="stack" style={{ gap: 8 }}>
                  <strong style={{ fontSize: 12 }}>Adicionar vídeo:</strong>
                  <ManualRemoteVideoInput 
                    deck={deck} 
                    onSet={(video) => updateDeck(deck.id, { video })} 
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {Object.keys(publishLogs).length > 0 && (
        <div className="stack" style={{ gap: 8, padding: 16, background: 'var(--color-bg-alt)', borderRadius: 8 }}>
          <strong style={{ fontSize: 12 }}>Log de publicação:</strong>
          <div className="stack" style={{ gap: 4 }}>
            {Object.entries(publishLogs).flatMap(([deckId, logs]) => 
              logs.map((log, index) => (
                <div key={`${deckId}-${index}`} className="caption" style={{ fontFamily: 'monospace' }}>
                  {log}
                </div>
              ))
            )}
          </div>
          <button 
            className="btn btn-ghost" 
            onClick={() => setPublishLogs({})}
          >
            Limpar logs
          </button>
        </div>
      )}

      {deckToDelete && (
        <div className="stack" style={{ gap: 12, padding: 16, background: 'var(--color-danger)', borderRadius: 8 }}>
          <strong>Confirmar exclusão</strong>
          <div>Tem certeza que deseja excluir o baralho "{decks.find(d => d.id === deckToDelete)?.name}"?</div>
          <div className="inline" style={{ gap: 8 }}>
            <button 
              className="btn btn-danger" 
              onClick={() => handleDeleteDeck(deckToDelete)}
            >
              Sim, excluir
            </button>
            <button 
              className="btn btn-ghost" 
              onClick={() => setDeckToDelete(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
