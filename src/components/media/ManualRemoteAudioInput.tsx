import React, { useState } from 'react';
import { Deck, DeckAudioMeta } from '../../domain/models';

interface ManualRemoteAudioInputProps {
  deck: Deck;
  onSet: (meta: DeckAudioMeta) => void;
}

export const ManualRemoteAudioInput: React.FC<ManualRemoteAudioInputProps> = ({ deck, onSet }) => {
  const [url, setUrl] = useState('');
  const [processing, setProcessing] = useState(false);

  const apply = async () => {
    if (!url.trim()) return;
    setProcessing(true);
    let clean = url.trim();
    
    // Reject gs:// URLs as they're not directly accessible via audio tag
    if (clean.startsWith('gs://')) {
      alert('Use o link público (https) obtido pelo botão "Obter URL de download" no Firebase Storage.');
      setProcessing(false); 
      return;
    }
    
    // Generate minimal metadata
    const nameGuess = clean.split('?')[0].split('/').pop() || 'audio.mp3';
    
    // Try HEAD request to get content-type/size (not essential)
    let size = 0; 
    let type = 'audio/mpeg';
    try { 
      const head = await fetch(clean, { method: 'HEAD' }); 
      if (head.ok) { 
        size = Number(head.headers.get('content-length') || 0); 
        const ct = head.headers.get('content-type'); 
        if (ct) type = ct; 
      } 
    } catch { 
      // ignore 
    }
    
    onSet({ 
      name: nameGuess, 
      size, 
      type, 
      key: clean, 
      remotePath: undefined, 
      downloadUrl: clean 
    });
    setProcessing(false); 
    setUrl('');
  };

  return (
    <div className="stack" style={{ gap: 4 }}>
      <input 
        placeholder="Ou cole URL pública do áudio" 
        value={url} 
        onChange={e => setUrl(e.target.value)} 
        onKeyDown={e => { 
          if (e.key === 'Enter') { 
            e.preventDefault(); 
            apply(); 
          } 
        }} 
      />
      <div className="inline" style={{ gap: 6 }}>
        <button 
          className="btn btn-secondary" 
          type="button" 
          disabled={!url.trim() || processing} 
          onClick={apply}
        >
          Usar URL
        </button>
        {processing && <span className="caption">Validando...</span>}
      </div>
      <span className="caption" style={{ opacity: 0.7 }}>
        Cole a URL de download do Firebase Storage (começa com https) ou outro host público. 
        Será referenciada diretamente.
      </span>
    </div>
  );
};
