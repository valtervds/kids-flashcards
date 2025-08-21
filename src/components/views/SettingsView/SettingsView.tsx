import React, { useState, useRef } from 'react';
import { MascoteTTS } from '../../MascoteTTS';

interface SettingsViewProps {
  sonsAtivos: boolean;
  setSonsAtivos: (ativo: boolean) => void;
  autoAvaliarVoz: boolean;
  setAutoAvaliarVoz: (auto: boolean) => void;
  audioPronto: boolean;
  primeiraInteracaoRef: React.MutableRefObject<boolean>;
  safePlay: (tipo: 'ok' | 'erro') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  sonsAtivos,
  setSonsAtivos,
  autoAvaliarVoz,
  setAutoAvaliarVoz,
  audioPronto,
  primeiraInteracaoRef,
  safePlay
}) => {
  return (
    <>
      <header className="stack" style={{ gap: 4 }}>
        <h1>Configurações</h1>
        <div className="subtitle">Ajuste preferências da aplicação</div>
      </header>
      <section className="card stack" style={{ gap: 14 }}>
        <div className="card-header">Som & Voz</div>
        <label className="inline" style={{ fontSize: 14 }}>
          <input type="checkbox" checked={sonsAtivos} onChange={e => setSonsAtivos(e.target.checked)} /> Som ativo
        </label>
        <button 
          className="btn btn-secondary" 
          type="button" 
          style={{ maxWidth: 140 }} 
          onClick={() => { 
            primeiraInteracaoRef.current = true; 
            safePlay('ok'); 
          }}
        >
          Testar som
        </button>
        {!audioPronto && sonsAtivos && (
          <span className="caption">Toque "Testar som" após interação se não ouvir.</span>
        )}
        <MascoteTTS texto="Exemplo de voz para teste." showVoiceSelector />
      </section>
      <section className="card stack" style={{ gap: 14 }}>
        <div className="card-header">Avaliação</div>
        <label className="inline" style={{ fontSize: 14 }}>
          <input 
            type="checkbox" 
            checked={autoAvaliarVoz} 
            onChange={e => setAutoAvaliarVoz(e.target.checked)} 
          /> 
          Auto avaliar resposta de voz (estudo)
        </label>
      </section>
    </>
  );
};
