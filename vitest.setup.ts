// Setup mínimo sem jest-dom para evitar conflitos ESM
if (!(globalThis as any).Audio) {
  (globalThis as any).Audio = class { play() { return Promise.resolve(); } } as any;
}

// Mock simples para speech APIs se necessário
Object.defineProperty(window, 'speechSynthesis', {
  value: {
    speak: () => {},
    cancel: () => {},
    getVoices: () => [],
    paused: false,
    pending: false
  },
});
