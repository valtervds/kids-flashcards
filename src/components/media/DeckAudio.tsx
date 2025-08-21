import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DeckAudioMeta } from '../../domain/models';
import { useAudioStorage } from '../../services/media/audioStorage';

interface DeckAudioPlayerProps {
  meta: DeckAudioMeta;
  onRemove: () => void;
}

export const DeckAudioPlayer: React.FC<DeckAudioPlayerProps> = ({ meta, onRemove }) => {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | undefined>(undefined);
  const { getAudioObjectUrl } = useAudioStorage();

  useEffect(() => { 
    let alive = true; 
    getAudioObjectUrl(meta).then(u => { 
      if (alive) setUrl(u); 
    }); 
    return () => { alive = false; }; 
  }, [meta.key, getAudioObjectUrl]);

  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="inline" style={{ justifyContent: 'space-between' }}>
        <span className="caption">
          {meta.name} ({(meta.size / 1024).toFixed(0)} KB)
        </span>
        <button className="btn btn-ghost" type="button" onClick={onRemove}>
          Remover áudio
        </button>
      </div>
      {url ? (
        <audio 
          ref={ref} 
          controls 
          preload="metadata" 
          src={url} 
          style={{ width: '100%' }} 
        />
      ) : (
        <div className="caption">Carregando áudio…</div>
      )}
    </div>
  );
};

interface DeckAudioInlineProps {
  meta: DeckAudioMeta;
}

export const DeckAudioInline: React.FC<DeckAudioInlineProps> = ({ meta }) => {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [tentando, setTentando] = useState(false);
  const { getAudioObjectUrl } = useAudioStorage();

  const carregar = useCallback(async () => {
    setTentando(true); 
    setErro(null);
    try {
      const u = await getAudioObjectUrl(meta);
      if (!u) setErro('Não foi possível carregar o áudio');
      setUrl(u);
    } catch (e: any) {
      console.warn('[DeckAudioInline] falha', e);
      setErro(e?.message || 'Falha ao carregar áudio');
    } finally { 
      setTentando(false); 
    }
  }, [meta.key, getAudioObjectUrl]);

  useEffect(() => { 
    let alive = true; 
    carregar(); 
    return () => { alive = false; }; 
  }, [carregar]);

  if (erro) {
    return (
      <div className="caption" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>Áudio: {erro}</span>
        <button 
          className="btn btn-ghost" 
          type="button" 
          disabled={tentando} 
          onClick={carregar}
        >
          {tentando ? 'Tentando...' : 'Tentar novamente'}
        </button>
      </div>
    );
  }

  if (!url) return <div className="caption">Carregando áudio...</div>;

  return (
    <audio 
      controls 
      preload="metadata" 
      src={url} 
      style={{ width: '100%' }} 
    />
  );
};
