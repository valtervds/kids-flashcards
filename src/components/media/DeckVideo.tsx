import React, { useState } from 'react';
import { Deck, DeckVideoMeta } from '../../domain/models';

interface DeckVideoPlayerProps {
  meta: DeckVideoMeta;
  onRemove: () => void;
}

export const DeckVideoPlayer: React.FC<DeckVideoPlayerProps> = ({ meta, onRemove }) => {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="inline" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 12 }}>Vídeo:</strong>
        <button className="btn btn-ghost" type="button" onClick={onRemove}>
          Remover
        </button>
      </div>
      <video 
        controls 
        preload="none" 
        style={{ maxWidth: '100%', border: '1px solid #2f4d70', borderRadius: 4 }} 
        poster={meta.posterUrl} 
        src={meta.downloadUrl || meta.remotePath || meta.key} 
      />
      <div className="caption" style={{ wordBreak: 'break-all' }}>
        {meta.downloadUrl || meta.remotePath || meta.key}
      </div>
    </div>
  );
};

interface ManualRemoteVideoInputProps {
  deck: Deck;
  onSet: (meta: DeckVideoMeta) => void;
}

export const ManualRemoteVideoInput: React.FC<ManualRemoteVideoInputProps> = ({ deck, onSet }) => {
  const [url, setUrl] = useState('');
  const [poster, setPoster] = useState('');
  const [open, setOpen] = useState(false);

  return (
    <details 
      open={open} 
      onToggle={e => setOpen((e.target as HTMLDetailsElement).open)} 
      style={{ background: '#13263b', padding: '6px 8px', borderRadius: 6 }}
    >
      <summary style={{ cursor: 'pointer', fontSize: 12 }}>Usar vídeo via URL</summary>
      <div className="stack" style={{ gap: 6, marginTop: 6 }}>
        <input 
          value={url} 
          onChange={e => setUrl(e.target.value)} 
          placeholder="URL do vídeo (MP4/M3U8)" 
          style={{ fontSize: 12 }} 
        />
        <input 
          value={poster} 
          onChange={e => setPoster(e.target.value)} 
          placeholder="Poster opcional (imagem)" 
          style={{ fontSize: 12 }} 
        />
        <div className="inline" style={{ gap: 6 }}>
          <button 
            className="btn btn-secondary" 
            type="button" 
            disabled={!url.trim()} 
            onClick={() => {
              try { 
                new URL(url); 
                poster && new URL(poster); 
              } catch { 
                alert('URL inválida'); 
                return; 
              }
              const meta: DeckVideoMeta = { 
                name: url.split('/').pop() || 'video', 
                size: 0, 
                type: 'video', 
                key: url, 
                downloadUrl: url, 
                remotePath: url, 
                ...(poster ? { posterUrl: poster } : {}) 
              };
              onSet(meta); 
              setUrl(''); 
              setPoster(''); 
              setOpen(false);
            }}
          >
            Aplicar
          </button>
          <button 
            className="btn btn-ghost" 
            type="button" 
            onClick={() => { setUrl(''); setPoster(''); }}
          >
            Limpar
          </button>
        </div>
        <div className="caption">O vídeo não é baixado agora. Será carregado via URL pública.</div>
      </div>
    </details>
  );
};
