import '@testing-library/jest-dom';

// Mock simples de speechSynthesis / Audio com listeners
const speechSynthesisMock: any = {
  speak: () => {},
  cancel: () => {},
  getVoices: () => [],
  _listeners: new Map<string, Function[]>(),
  addEventListener: function(evt: string, cb: Function) {
    const arr = this._listeners.get(evt) || [];
    arr.push(cb);
    this._listeners.set(evt, arr);
  },
  removeEventListener: function(evt: string, cb: Function) {
    const arr = this._listeners.get(evt) || [];
    this._listeners.set(evt, arr.filter(f => f !== cb));
  },
  // util para tests dispararem manualmente
  __emit: function(evt: string) {
    (this._listeners.get(evt) || []).forEach(f => {
      try { f(); } catch { /* ignore */ }
    });
  }
};
Object.defineProperty(window, 'speechSynthesis', { value: speechSynthesisMock, writable: true });

if (!(global as any).Audio) {
  (global as any).Audio = class { play() { return Promise.resolve(); } } as any;
}

// Evita erros "Not implemented: HTMLMediaElement.prototype.play" no jsdom
if ((global as any).HTMLMediaElement) {
  const proto = (global as any).HTMLMediaElement.prototype as any;
  if (!proto.play || !proto.play._isMock) {
    proto.play = jest.fn().mockResolvedValue(undefined);
    (proto.play as any)._isMock = true;
  }
}
