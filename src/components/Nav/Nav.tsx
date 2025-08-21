import React from 'react';

interface NavProps {
  view: string;
  setView: (view: 'home' | 'study' | 'decks' | 'settings') => void;
}

export const Nav: React.FC<NavProps> = ({ view, setView }) => {
  return (
    <nav className="nav-bar">
      <button 
        className={view === 'home' ? 'active' : ''} 
        onClick={() => setView('home')}
      >
        Home
      </button>
      <button 
        className={view === 'study' ? 'active' : ''} 
        onClick={() => setView('study')}
      >
        Estudar
      </button>
      <button 
        className={view === 'decks' ? 'active' : ''} 
        onClick={() => setView('decks')}
      >
        Baralhos
      </button>
      <button 
        className={view === 'settings' ? 'active' : ''} 
        onClick={() => setView('settings')}
      >
        Configurações
      </button>
    </nav>
  );
};
