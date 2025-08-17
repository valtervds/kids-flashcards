
import React, { useState, useEffect, useRef } from 'react';
// Removido: legado cloudSync substituído por fluxo Firebase moderno
import { resolveFirebaseConfig } from './firebase/defaultConfig';
// Fase 1 Firebase infra (usado progressivamente). Variáveis esperadas via Vite env:
// import.meta.env.VITE_FB_API_KEY etc. Integração completa ocorrerá em fases.
import { MascoteTTS } from './components/MascoteTTS';
import { Stars } from './components/Stars';
import { avaliar, respostasCorretas, normalizar } from './evaluation';
import { Deck, DeckAudioMeta, Flashcard, DeckStats, ProgressMap } from './domain/models';
import { gerarDica, obterRespostaCorretaPreferida } from './utils/scoring';
import { useLocalDecks } from './features/decks/useLocalDecks';
import { DeckImport } from './components/DeckImport';
// Imports estáticos para evitar falhas de carregamento dinâmico em GitHub Pages (chunks 404)
import { createDeck, updateDeckDoc, listenPublishedDecks, deleteDeckDoc } from './firebase/decksRepo';
import { uploadDeckAudio } from './firebase/storage';
import { listenProgress, updateProgress } from './firebase/progressRepo';

// Declaração global para suportar webkitSpeechRecognition
declare global { interface Window { webkitSpeechRecognition?: any; SpeechRecognition?: any; } }

// -------------------------- Reconhecimento de Voz --------------------------
interface ReconhecimentoProps { onResultado: (texto: string, final: boolean) => void; }
const ReconhecimentoVoz: React.FC<ReconhecimentoProps> = ({ onResultado }) => {
  const [suporte, setSuporte] = useState(() => typeof window !== 'undefined' && (!!(window as any).SpeechRecognition || !!window.webkitSpeechRecognition));
  const [gravando, setGravando] = useState(false);
  const [transcricao, setTranscricao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const instanciaRef = useRef<any | null>(null);

  const iniciar = () => {
    if (!suporte || gravando) return;
    setErro(null); setTranscricao('');
    const SR: any = (window as any).SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSuporte(false); return; }
    const rec = new SR();
    instanciaRef.current = rec;
    rec.lang = 'pt-BR'; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1;
    let finalConcat = '';
    rec.onstart = () => setGravando(true);
    rec.onerror = (e: any) => { console.warn('[ASR] erro', e.error); setErro(e.error); };
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          finalConcat += r[0].transcript;
          onResultado((finalConcat).trim(), false);
        } else {
          const parcial = (finalConcat + r[0].transcript).trim();
          setTranscricao(parcial);
          onResultado(parcial, false);
        }
      }
      if (finalConcat) setTranscricao(finalConcat.trim());
    };
    rec.onend = () => { setGravando(false); const saida = (finalConcat || transcricao).trim(); if (saida) onResultado(saida, true); };
    try { rec.start(); } catch (e) { console.error(e); }
  };
  const parar = () => { try { instanciaRef.current?.stop(); } catch { /* noop */ } };

  return (
    <div className="inline" style={{ gap: 8 }}>
      <button className="btn" type="button" onClick={iniciar} disabled={!suporte || gravando}>{gravando ? '🎙 Gravando…' : 'Falar 🎤'}</button>
      {gravando && <button className="btn btn-secondary" type="button" onClick={parar}>Parar</button>}
      {!suporte && <span style={{ color: 'var(--color-danger)', fontSize: 12 }}>Sem suporte</span>}
      {erro && <span style={{ color: 'var(--color-danger)', fontSize: 12 }}>Erro: {erro}</span>}
    </div>
  );
};

// ------------------------------- App Principal -----------------------------
export const App: React.FC = () => {
  const defaultPerguntas = process.env.NODE_ENV === 'test' ? [
    'Qual é a capital do Brasil?',
    'Quanto é 3 + 4?',
    'O que é um flashcard?'
  ] : [];

  // Estrutura multi-deck (tipos movidos para domain/models)

  // ---------------- Audio Storage (IndexedDB) ----------------
  const openAudioDb = () => new Promise<IDBDatabase | null>((resolve) => {
    if (!('indexedDB' in window)) return resolve(null);
    const req = indexedDB.open('deck-audio-db', 1);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains('audios')) db.createObjectStore('audios'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  const saveAudioBlob = async (key: string, blob: Blob) => {
    const db = await openAudioDb(); if (!db) return false;
    return new Promise<boolean>((res)=> { const tx = db.transaction('audios','readwrite'); tx.objectStore('audios').put(blob, key); tx.oncomplete=()=>res(true); tx.onerror=()=>res(false); });
  };
  const loadAudioBlob = async (key: string): Promise<Blob | null> => {
    const db = await openAudioDb(); if (!db) return null;
    return new Promise((res)=> { const tx = db.transaction('audios','readonly'); const r = tx.objectStore('audios').get(key); r.onsuccess=()=> res(r.result || null); r.onerror=()=> res(null); });
  };
  const deleteAudioBlob = async (key: string) => { const db = await openAudioDb(); if (!db) return; const tx = db.transaction('audios','readwrite'); tx.objectStore('audios').delete(key); };
  const audioUrlCache = useRef<Record<string,string>>({});
  const getAudioObjectUrl = async (meta?: DeckAudioMeta) => {
    if (!meta) return undefined; if (audioUrlCache.current[meta.key]) return audioUrlCache.current[meta.key];
    const blob = await loadAudioBlob(meta.key); if (!blob) return undefined; const url = URL.createObjectURL(blob); audioUrlCache.current[meta.key] = url; return url;
  };

  const DeckAudioPlayer: React.FC<{ meta: DeckAudioMeta; onRemove: () => void }> = ({ meta, onRemove }) => {
    const ref = useRef<HTMLAudioElement | null>(null);
    const [url, setUrl] = useState<string | undefined>(undefined);
    useEffect(()=> { let alive = true; getAudioObjectUrl(meta).then(u=> { if(alive) setUrl(u); }); return ()=> { alive=false; }; }, [meta.key]);
    return (
      <div className="stack" style={{ gap:4 }}>
        <div className="inline" style={{ justifyContent:'space-between' }}>
          <span className="caption">{meta.name} ({(meta.size/1024).toFixed(0)} KB)</span>
          <button className="btn btn-ghost" type="button" onClick={onRemove}>Remover áudio</button>
        </div>
        {url ? <audio ref={ref} controls preload="metadata" src={url} style={{ width:'100%' }} /> : <div className="caption">Carregando áudio…</div>}
      </div>
    );
  };

  const DeckAudioInline: React.FC<{ meta: DeckAudioMeta }> = ({ meta }) => {
    const [url, setUrl] = useState<string | undefined>(undefined);
    useEffect(()=> { let alive=true; getAudioObjectUrl(meta).then(u=> { if(alive) setUrl(u); }); return ()=> { alive=false; }; }, [meta.key]);
    if (!url) return <div className="caption">Áudio…</div>;
    return <audio controls preload="metadata" src={url} style={{ width:'100%' }} />;
  };
  // DeckStats movido para domain/models

  // Decks locais via hook
  const { decks, setDecks } = useLocalDecks();

  const loadStats = (): Record<string, DeckStats> => {
    try { const raw = localStorage.getItem('deck.stats'); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
    return {};
  };
  const [stats, setStats] = useState<Record<string, DeckStats>>(loadStats);
  useEffect(() => { try { localStorage.setItem('deck.stats', JSON.stringify(stats)); } catch { /* ignore */ } }, [stats]);

  const [currentDeckId, setCurrentDeckId] = useState<string>('default');
  const getCurrentDeck = () => {
    if (currentDeckId === 'default') return null;
    const local = decks.find(d => d.id === currentDeckId);
    if (local) return local;
    const remote = cloudDecks.find(d => d.id === currentDeckId);
    return remote || null;
  };
  const usandoDeckImportado = !!getCurrentDeck();
  const perguntas = getCurrentDeck() ? getCurrentDeck()!.cards.map(c => c.question) : defaultPerguntas;

  // Estados principais
  const [view, setView] = useState<'home' | 'study' | 'settings' | 'decks'>(() => process.env.NODE_ENV === 'test' ? 'study' : 'home');
  const [indice, setIndice] = useState(0);
  const [respostaEntrada, setRespostaEntrada] = useState('');
  const [origemUltimaEntrada, setOrigemUltimaEntrada] = useState<'voz' | 'manual' | null>(null);
  const [resultado, setResultado] = useState<ReturnType<typeof avaliar> | null>(null);
  const [autoAvaliarVoz, setAutoAvaliarVoz] = useState(true);
  const [revelarQtde, setRevelarQtde] = useState(0);
  const [mostrarRespostaCorreta, setMostrarRespostaCorreta] = useState(false);
  const [sonsAtivos, setSonsAtivos] = useState(true);
  const [audioPronto, setAudioPronto] = useState(false);
  const [inicioPerguntaTs, setInicioPerguntaTs] = useState(Date.now());
  const [ultimoTempoRespostaMs, setUltimoTempoRespostaMs] = useState<number | null>(null);
  // Histórico de pontuações por deck/cartão
  const loadProgress = (): ProgressMap => { try { const raw = localStorage.getItem('deck.progress'); if (raw) return JSON.parse(raw); } catch { /* ignore */ } return {}; };
  const [progress, setProgress] = useState<ProgressMap>(loadProgress);
  useEffect(() => { try { localStorage.setItem('deck.progress', JSON.stringify(progress)); } catch { /* ignore */ } }, [progress]);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  // --------- Cloud Sync State ---------
  // Cloud sync legado removido

  // --------- Firebase Cloud (publicação decks) ---------
  const safeEnv = (k: string) => {
    const winAny: any = (typeof window !== 'undefined') ? window : {};
    const vite = winAny.__VITE_ENV__ || {}; // possibilidade de injetar manualmente em index.html se quiser
    const proc: any = (typeof process !== 'undefined') ? process : {};
    return vite[k] || proc.env?.[k] || undefined;
  };
  const firebaseEnv = resolveFirebaseConfig();
  const firebaseAvailable = !!firebaseEnv.apiKey && process.env.NODE_ENV !== 'test';
  // Firebase habilitado internamente; se falhar configuração de Auth desabilitamos em runtime
  const [firebaseEnabled, setFirebaseEnabled] = useState(true);
  // Expor config para debug (somente leitura)
  if (typeof window !== 'undefined') {
    (window as any).__FB_CFG = firebaseEnv;
  }
  const [firebaseStatus, setFirebaseStatus] = useState('');
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const cloudDbRef = useRef<any>(null);
  const cloudStorageRef = useRef<any>(null);
  const [cloudDecks, setCloudDecks] = useState<Deck[]>([]);
  // Marca quando recebemos o primeiro snapshot (evita race de estudo antes de carregar)
  const [cloudDecksLoaded, setCloudDecksLoaded] = useState(false);
  // Efeito de migração de seleção para id cloud quando disponível
  useEffect(() => {
    if (!cloudDecksLoaded) return;
    if (currentDeckId === 'default') return;
    const local: any = decks.find(d => d.id === currentDeckId);
    if (local && local.cloudId) {
      const remote = cloudDecks.find(cd => cd.id === local.cloudId);
      if (remote) {
        setCurrentDeckId(remote.id);
        console.log('[deck:migrate] migrado para id cloud', remote.id);
      }
    }
  }, [cloudDecksLoaded, decks, cloudDecks, currentDeckId]);
  // Log de publicação por deck (apenas sessão atual)
  const [publishLogs, setPublishLogs] = useState<Record<string,string[]>>({});
  const appendPublishLog = (deckId: string, msg: string) => {
    setPublishLogs(prev => {
      const list = prev[deckId] ? [...prev[deckId]] : [];
      const carimbo = new Date().toLocaleTimeString();
      list.push(`${carimbo} ${msg}`);
      if (list.length > 100) list.splice(0, list.length - 100); // mantém últimos 100
      return { ...prev, [deckId]: list };
    });
  };
  const remoteUnsubsRef = useRef<Record<string, () => void>>({});
  const initFirebaseFull = async () => {
    if (!firebaseAvailable || cloudDbRef.current) return;
    try {
      setFirebaseStatus('Conectando...');
      const { initFirebaseApp, ensureAnonymousAuth } = await import('./firebase/app');
      console.log('[firebase:init] config', firebaseEnv);
      const { db, auth, storage } = await initFirebaseApp(firebaseEnv as any);
      const uid = await ensureAnonymousAuth(auth);
      console.log('[firebase:init] anon uid', uid);
      setFirebaseUid(uid);
      cloudDbRef.current = db; cloudStorageRef.current = storage;
      // Helpers de debug para investigar permission-denied
      if (typeof window !== 'undefined') {
        (window as any).__FB_DEBUG = {
          async testReadAll() {
            const { getDocs, collection } = await import('firebase/firestore');
            try { const snap = await getDocs(collection(db,'decks')); console.log('[__FB_DEBUG.testReadAll] docs', snap.docs.map(d=>({id:d.id, ...d.data()}))); }
            catch(e) { console.warn('[__FB_DEBUG.testReadAll] erro', e); }
          },
          async testReadPublished() {
            const { getDocs, collection, query, where } = await import('firebase/firestore');
            try { const q = query(collection(db,'decks'), where('published','==', true)); const snap = await getDocs(q); console.log('[__FB_DEBUG.testReadPublished] docs', snap.docs.map(d=>({id:d.id, ...d.data()}))); }
            catch(e) { console.warn('[__FB_DEBUG.testReadPublished] erro', e); }
          },
          async createTestDeck() {
            const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
            try { const ref = await addDoc(collection(db,'decks'), { ownerId: uid, name: 'Debug Deck', active: true, published: true, version:1, cards: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); console.log('[__FB_DEBUG.createTestDeck] criado', ref.id); }
            catch(e) { console.warn('[__FB_DEBUG.createTestDeck] erro', e); }
          },
          async getDeck(id:string) {
            const { doc, getDoc, collection } = await import('firebase/firestore');
            try { const ref = doc(collection(db,'decks'), id); const snap = await getDoc(ref); console.log('[__FB_DEBUG.getDeck]', id, snap.exists()? snap.data(): 'NÃO EXISTE'); }
            catch(e) { console.warn('[__FB_DEBUG.getDeck] erro', e); }
          }
        };
      }
      listenPublishedDecks(db, (list: any[]) => {
        console.log('[firebase:listener] published decks snapshot', list.length);
        const mapped: Deck[] = list.map((d: any) => ({ id: d.id, name: d.name, active: true, createdAt: Date.now(), cards: d.cards || [], published: d.published, cloudId: d.id, audio: d.audioMeta ? { name: d.audioMeta.fileName, size: d.audioMeta.size||0, type: d.audioMeta.contentType||'audio/mpeg', key: d.audioMeta.storagePath } : undefined }));
        setCloudDecks(mapped);
        setCloudDecksLoaded(true);
      }, (err: any) => {
        console.warn('[firebase:listener] decks error', err?.code || err?.message || err);
        (window as any).__FB_DECKS_ERR = err;
        setFirebaseStatus(s => s === 'Online' ? 'Online (listener erro - fallback polling)' : s);
      });
      setFirebaseStatus('Online');
    } catch (e:any) {
      console.warn(e);
      const msg = String(e?.code || e?.message || e);
      if (msg.includes('auth/configuration-not-found') || msg.includes('auth/operation-not-allowed')) {
        setFirebaseStatus('Config inválida');
        setFirebaseEnabled(false);
        if (typeof window !== 'undefined') (window as any).__FB_AUTH_ERR = msg;
      } else {
        setFirebaseStatus('Erro init');
      }
    }
  };
  useEffect(()=> { initFirebaseFull(); }, []);
  // Aviso se demorar para inicializar
  const [firebaseInitDelay, setFirebaseInitDelay] = useState(false);
  useEffect(()=> {
    const t = setTimeout(()=> {
      if (firebaseEnabled && !cloudDbRef.current) setFirebaseInitDelay(true);
    }, 5000);
    return ()=> clearTimeout(t);
  }, [firebaseEnabled]);
  const forceFirebaseInit = () => {
    if (!cloudDbRef.current) {
      appendPublishLog && appendPublishLog('global','Forçando init Firebase...');
      initFirebaseFull();
    }
  };
  // Flush pendente ao fechar/ocultar
  useEffect(() => {
    const handler = () => { if (firebaseEnabled && firebaseUid && cloudDbRef.current) { flushRemote(cloudDbRef.current, firebaseUid); } };
    window.addEventListener('beforeunload', handler);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') handler(); });
    return () => { window.removeEventListener('beforeunload', handler); }; // visibilitychange não precisa remover
  }, [firebaseEnabled, firebaseUid]);

  // Listener progresso remoto (decks cloud)
  useEffect(() => {
    if (!firebaseEnabled || !firebaseUid || !cloudDbRef.current) {
      Object.values(remoteUnsubsRef.current).forEach(u => u());
      remoteUnsubsRef.current = {};
      return;
    }
    (async () => {
      const ids = new Set<string>();
      cloudDecks.forEach(d => d.cloudId && ids.add(d.cloudId));
      decks.forEach(d => d.cloudId && ids.add(d.cloudId));
      // remove não usados
      for (const id of Object.keys(remoteUnsubsRef.current)) {
        if (!ids.has(id)) { remoteUnsubsRef.current[id](); delete remoteUnsubsRef.current[id]; }
      }
      ids.forEach(id => {
        if (remoteUnsubsRef.current[id]) return;
        const unsub = listenProgress(cloudDbRef.current!, firebaseUid, id, doc => {
          setProgress(prev => {
            const perCard = doc.perCard || {};
            const mapped: Record<number, number[]> = {} as any;
            Object.keys(perCard).forEach(k => { mapped[Number(k)] = perCard[k].scores || []; });
            // tenta achar deck local associado
            const localDeck = decks.find(d => d.cloudId === id);
            if (!localDeck) return { ...prev, [id]: mapped }; // fallback id cloud
            return { ...prev, [localDeck.id]: mapped };
          });
        });
        remoteUnsubsRef.current[id] = unsub;
      });
    })();
  }, [firebaseEnabled, firebaseUid, cloudDbRef.current, cloudDecks, decks]);
  const publishDeckFirebase = async (deck: Deck) => {
    if (!firebaseEnabled) return alert('Firebase não habilitado');
    if (!cloudDbRef.current) return alert('Firebase não pronto');
    if (!deck.cards.length) {
      appendPublishLog(deck.id, 'Publicação cancelada: baralho vazio.');
      return alert('Adicione pelo menos 1 carta antes de publicar (requisito das regras).');
    }
    try {
      console.log('[publishDeckFirebase] iniciando', { deckId: deck.id, cloudId: deck.cloudId, name: deck.name });
      appendPublishLog(deck.id, 'Iniciando publicação...');
      setFirebaseStatus('Publicando...');
      let cloudId = deck.cloudId;
      if (!cloudId) {
        cloudId = await createDeck(cloudDbRef.current, { ownerId: firebaseUid || 'anon', name: deck.name, active: deck.active, published: true, cards: deck.cards });
        updateDeck(deck.id, { cloudId, published: true });
        console.log('[publishDeckFirebase] deck criado', { cloudId });
        appendPublishLog(deck.id, `Deck criado na nuvem (id=${cloudId}).`);
      } else {
        await updateDeckDoc(cloudDbRef.current, cloudId, { name: deck.name, active: deck.active, published: true, cards: deck.cards });
        console.log('[publishDeckFirebase] deck atualizado', { cloudId });
        appendPublishLog(deck.id, `Deck atualizado (id=${cloudId}).`);
      }
      if (deck.audio && cloudStorageRef.current) {
        const blob = await loadAudioBlob(deck.audio.key);
        if (blob) {
          try {
            appendPublishLog(deck.id, 'Enviando áudio...');
            const up = await uploadDeckAudio(cloudStorageRef.current, cloudId!, blob, deck.audio.name);
            await updateDeckDoc(cloudDbRef.current, cloudId!, { audioMeta: { fileName: deck.audio.name, storagePath: up.storagePath, contentType: deck.audio.type, size: deck.audio.size }, published: true });
            console.log('[publishDeckFirebase] audio enviado', { cloudId, storagePath: up.storagePath });
            appendPublishLog(deck.id, 'Áudio enviado e metadata salva.');
          } catch (err:any) {
            console.error('[publishDeckFirebase] falha upload audio', err);
            appendPublishLog(deck.id, 'Falha upload áudio: ' + (err?.code || err?.message || String(err)));
          }
        }
      }
      setFirebaseStatus('Publicado');
      console.log('[publishDeckFirebase] finalizado com sucesso');
      appendPublishLog(deck.id, 'Publicação concluída com sucesso.');
      alert('Deck publicado na nuvem.');
    } catch (e:any) {
      console.error('[publishDeckFirebase] erro', e);
      const code = e?.code || e?.message || String(e);
      setFirebaseStatus('Erro publicar');
      appendPublishLog(deck.id, 'Erro: ' + code);
      if (String(code).includes('permission-denied')) {
        appendPublishLog(deck.id, 'Verifique regras Firestore: leitura pública de published==true e ownerId corresponde ao usuário.');
      }
      alert('Falha ao publicar deck (ver console). Código: ' + code);
    }
  };
  // Fallback: enquanto nenhum deck cloud carregado ainda, continua mostrando decks locais ativos
  const studyDeckSource = firebaseEnabled ? (cloudDecks.length ? cloudDecks : decks.filter(d=> d.active)) : decks.filter(d=> d.active);

  // Áudio refs
  const audioOkRef = useRef<HTMLAudioElement | null>(null);
  const audioErroRef = useRef<HTMLAudioElement | null>(null);
  const interagiuRef = useRef(false);

  // Marcar primeira interação para liberar WebAudio
  useEffect(() => {
    const marcar = () => { interagiuRef.current = true; };
    window.addEventListener('pointerdown', marcar, { once: true });
    window.addEventListener('keydown', marcar, { once: true });
    return () => { window.removeEventListener('pointerdown', marcar); window.removeEventListener('keydown', marcar); };
  }, []);

  // Gera tons via Web Audio
  const gerarTons = (padrao: number[]) => {
    if (!sonsAtivos || !interagiuRef.current) return;
    const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    try {
      const ctx = new Ctx(); let t = ctx.currentTime;
      padrao.forEach(freq => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, t);
        osc.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        osc.start(t); osc.stop(t + 0.3); t += 0.18;
      });
      setAudioPronto(true);
    } catch { /* ignore */ }
  };

  const safePlay = (tipo: 'ok' | 'erro') => {
    if (!sonsAtivos) return;
    if (tipo === 'ok') gerarTons([880, 1320]); else gerarTons([220, 180]);
    const el = (tipo === 'ok' ? audioOkRef.current : audioErroRef.current);
    try { if (el) { el.currentTime = 0; el.play().catch(()=>{}); } } catch {/* */}
  };

  // Helpers de dica e resposta correta movidos para utils/scoring

  const submeter = (origem: 'voz' | 'manual') => {
  const valor = respostaEntrada;
    if (!valor.trim()) return;
    let res: any;
    if (usandoDeckImportado) {
      const answers = getCurrentDeck()!.cards[indice]?.answers || [];
      const base = normalizar(valor);
      const match = answers.find(a => normalizar(a) === base);
      if (match) res = { correto: true, score: 5, detalhes: 'Correspondência exata', similaridade: 1 };
      else {
        const palavrasResp = base.split(' ');
        let melhor = 0;
        for (const g of answers) {
          const gw = normalizar(g).split(' ');
          const inter = gw.filter(w => palavrasResp.includes(w));
          const ratio = inter.length / Math.max(gw.length, 1);
          if (ratio > melhor) melhor = ratio;
        }
        let score = 1;
        if (melhor >= 0.8) score = 4; else if (melhor >= 0.5) score = 3; else if (melhor >= 0.3) score = 2;
        res = { correto: false, score, detalhes: `Similaridade ${(melhor * 100).toFixed(0)}%`, similaridade: melhor };
      }
    } else {
      res = avaliar(indice, valor);
    }
    setResultado(res);
    setUltimoTempoRespostaMs(Date.now() - inicioPerguntaTs);
    if (res.correto) safePlay('ok'); else safePlay('erro');
    // atualizar estatísticas
    setStats(prev => {
      const id = usandoDeckImportado ? currentDeckId : 'default';
      const cur = prev[id] || { attempts: 0, correct: 0, sessions: 0 };
      return { ...prev, [id]: { ...cur, attempts: cur.attempts + 1, correct: cur.correct + (res.correto ? 1 : 0) } };
    });
    // registrar progresso por cartão
  const deckKey = usandoDeckImportado ? currentDeckId : (getCurrentDeck()?.cloudId ? getCurrentDeck()!.id : 'default');
    setProgress(prev => {
      const d = prev[deckKey] || {};
      const arr = d[indice] ? [...d[indice]] : [];
      arr.push(res.correto ? 5 : res.score);
      if (arr.length > 50) arr.splice(0, arr.length - 50); // mantém últimos 50
      return { ...prev, [deckKey]: { ...d, [indice]: arr } };
    });
    // Enfileira update remoto (debounce simples)
    if (firebaseEnabled && getCurrentDeck()?.cloudId && firebaseUid && cloudDbRef.current) {
      queueRemoteProgressUpdate(getCurrentDeck()!.cloudId!, indice, res.correto ? 5 : res.score, res.correto);
  scheduleFlush(cloudDbRef.current, firebaseUid);
    }
  };

  const proximaPergunta = () => {
    setIndice(p => (p + 1) % perguntas.length);
  setRespostaEntrada(''); setResultado(null); setMostrarRespostaCorreta(false); setOrigemUltimaEntrada(null);
    setRevelarQtde(0); setUltimoTempoRespostaMs(null); setInicioPerguntaTs(Date.now());
    // sessão concluída quando volta ao índice 0
    setStats(prev => {
      if ((indice + 1) % perguntas.length !== 0) return prev;
      const id = usandoDeckImportado ? currentDeckId : 'default';
      const cur = prev[id] || { attempts: 0, correct: 0, sessions: 0 };
      return { ...prev, [id]: { ...cur, sessions: cur.sessions + 1 } };
    });
    if (firebaseEnabled && getCurrentDeck()?.cloudId && firebaseUid && cloudDbRef.current && (indice + 1) % perguntas.length === 0) {
      queueSessionIncrement(getCurrentDeck()!.cloudId!);
  scheduleFlush(cloudDbRef.current, firebaseUid);
    }
  };

  // Auto-avaliar quando chegar voz
  useEffect(() => { /* auto avaliação tratada após final de voz */ }, []);

  const Nav = () => (
    <nav className="nav-bar">
      <button className={view==='home'? 'active':''} onClick={() => setView('home')}>Home</button>
      <button className={view==='study'? 'active':''} onClick={() => setView('study')}>Estudar</button>
      <button className={view==='decks'? 'active':''} onClick={() => setView('decks')}>Baralhos</button>
      <button className={view==='settings'? 'active':''} onClick={() => setView('settings')}>Configurações</button>
    </nav>
  );

  const StudyView = () => {
    // Guard de carregamento: se selecionado um deck cloud mas primeiro snapshot ainda não chegou
    if (currentDeckId !== 'default' && !getCurrentDeck() && firebaseEnabled && !cloudDecksLoaded) {
      return (
        <section className="card" style={{ padding:20 }}>
          <h2>Carregando baralho…</h2>
          <div className="caption">Aguardando dados do servidor.</div>
        </section>
      );
    }
    if (!perguntas.length) {
      return (
        <section className="card" style={{ padding:20 }}>
          <h2>Nenhuma pergunta</h2>
          <div className="caption">Este baralho não possui cartas ou falhou ao carregar. Volte e escolha outro.</div>
        </section>
      );
    }
    return (<>
      <header className="stack" style={{ gap: 4 }}>
        <h1>Kids Flashcards</h1>
        <div className="subtitle">Pratique e aprenda de forma interativa</div>
      </header>
      <section className="card stack" style={{ gap: 12 }}>
        <div className="card-header inline" style={{ justifyContent:'space-between', alignItems:'center', gap:12 }}>
          <span>Pergunta</span>
          <MascoteTTS texto={perguntas[indice]} showVoiceSelector={false} />
        </div>
        <div className="question-text">{perguntas[indice]}</div>
        {process.env.NODE_ENV === 'test' && (
          <button data-testid="simular-voz" className="btn btn-ghost" type="button" onClick={() => { setRespostaEntrada('Brasília'); setOrigemUltimaEntrada('voz'); if(autoAvaliarVoz) submeter('voz'); }}>Simular Voz</button>
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
        <form className="stack" style={{ gap:8 }} onSubmit={(e)=> { e.preventDefault(); submeter('manual'); }}>
          <div className="inline" style={{ gap:8, alignItems:'stretch' }}>
            <input type="text" value={respostaEntrada} onChange={e => { setRespostaEntrada(e.target.value); setOrigemUltimaEntrada('manual'); }} placeholder="Digite ou use o microfone" aria-label="Campo de resposta" style={{ flex:1 }} />
            <ReconhecimentoVoz onResultado={(texto, final) => { setRespostaEntrada(texto); setOrigemUltimaEntrada('voz'); if (final && autoAvaliarVoz) submeter('voz'); }} />
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
          <div className="hint-box">Dica: {gerarDica({ deck: getCurrentDeck(), respostasCorretas, usandoDeckImportado, indice, qt: revelarQtde, respostaEntrada })}</div>
        )}
        {mostrarRespostaCorreta && (
          <div className="answer-box">Resposta correta: <strong>{obterRespostaCorretaPreferida(getCurrentDeck(), respostasCorretas, usandoDeckImportado, indice)}</strong></div>
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
            <button className="btn btn-secondary" type="button" onClick={()=> setMostrarHistorico(m => !m)}>{mostrarHistorico ? 'Ocultar histórico' : 'Histórico'}</button>
          </div>
          {mostrarHistorico && (() => {
            const deckKey = usandoDeckImportado ? currentDeckId : (getCurrentDeck()?.cloudId ? getCurrentDeck()!.id : 'default');
            const arr = (progress[deckKey]?.[indice]) || [];
            const media = arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2) : '-';
            return (
              <div className="answer-box" style={{ maxHeight:140, overflow:'auto', fontSize:12 }}>
                <strong>Histórico ({arr.length})</strong><br/>
                Média: {media} • Últimos: {arr.slice(-10).join(', ') || '—'}
              </div>
            );
          })()}
          {/* Helper removido: dica só aparece quando usuário clica */}
        </section>
      )}
      {!resultado && (
        <div className="inline" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" type="button" onClick={proximaPergunta}>Próxima pergunta</button>
        </div>
      )}
    </>
  ); };

  const SettingsView = () => (
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
        <button className="btn btn-secondary" type="button" style={{ maxWidth: 140 }} onClick={() => { interagiuRef.current = true; safePlay('ok'); }}>Testar som</button>
        {!audioPronto && sonsAtivos && <span className="caption">Toque "Testar som" após interação se não ouvir.</span>}
        <MascoteTTS texto="Exemplo de voz para teste." showVoiceSelector />
      </section>
      <section className="card stack" style={{ gap: 14 }}>
        <div className="card-header">Avaliação</div>
        <label className="inline" style={{ fontSize: 14 }}>
          <input type="checkbox" checked={autoAvaliarVoz} onChange={e => setAutoAvaliarVoz(e.target.checked)} /> Auto avaliar resposta de voz (estudo)
        </label>
      </section>
  {/* UI de sincronização legado removida */}
  {/* Card de status Firebase oculto para simplificar UI */}
    </>
  );

  // CRUD helpers para decks
  const addDeck = (name: string, cards: Flashcard[]) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g,'-') + '-' + Date.now().toString(36).slice(-4);
    setDecks(prev => [...prev, { id, name, active: true, cards, createdAt: Date.now() }]);
    return id;
  };
  const updateDeck = (id: string, partial: Partial<Deck>) => setDecks(prev => prev.map(d => d.id === id ? { ...d, ...partial } : d));
  const deleteDeck = (id: string) => { setDecks(prev => prev.filter(d => d.id !== id)); if (currentDeckId === id) setCurrentDeckId('default'); };
  const updateCard = (deckId: string, index: number, card: Flashcard) => setDecks(prev => prev.map(d => d.id === deckId ? { ...d, cards: d.cards.map((c,i)=> i===index? card : c) } : d));
  const addCard = (deckId: string, card: Flashcard) => setDecks(prev => prev.map(d => d.id === deckId ? { ...d, cards: [...d.cards, card] } : d));
  const deleteCard = (deckId: string, index: number) => setDecks(prev => prev.map(d => d.id === deckId ? { ...d, cards: d.cards.filter((_,i)=>i!==index) } : d));
  const cloneCloudDeck = (cloud: Deck) => {
    // Evita duplicar se já houver local vinculado
    const exists = decks.find(d => d.cloudId === cloud.cloudId);
    if (exists) { alert('Já existe uma cópia local deste deck.'); return exists.id; }
    const id = cloud.name.toLowerCase().replace(/[^a-z0-9]+/g,'-') + '-cloud-' + Date.now().toString(36).slice(-4);
    const novo: Deck = { id, name: cloud.name, active: true, cards: cloud.cards, createdAt: Date.now(), cloudId: cloud.cloudId, published: true, audio: cloud.audio };
    setDecks(prev => [...prev, novo]);
    appendPublishLog(id, 'Clonado do cloud.');
    return id;
  };

  const AddCardForm: React.FC<{ deckId: string }> = ({ deckId }) => {
    const [q,setQ]=useState(''); const [a,setA]=useState('');
    return (
      <form className="flex-gap" onSubmit={e=>{e.preventDefault(); if(!q.trim()||!a.trim())return; addCard(deckId,{ question:q.trim(), answers:a.split('|').map(s=>s.trim()).filter(Boolean) }); setQ(''); setA('');}}>
        <input placeholder="Pergunta" value={q} onChange={e=>setQ(e.target.value)} />
        <input placeholder="Resp1 | Resp2" value={a} onChange={e=>setA(e.target.value)} />
        <button className="btn" type="submit">+</button>
      </form>
    );
  };

  const DecksView = () => {
    const [expanded, setExpanded] = useState<string | null>(null);
    const [newDeckName, setNewDeckName] = useState('');
    const [editingName, setEditingName] = useState('');
    // Decks publicados disponíveis no cloud que ainda não possuem cópia local
    const remoteOnly = cloudDecks.filter(cd => !decks.some(ld => ld.cloudId && ld.cloudId === cd.cloudId));
    return (
      <>
        <header className="stack" style={{ gap: 4 }}>
          <h1>Gerenciar Baralhos</h1>
          <div className="subtitle">Visualize, renomeie, ative ou edite as cartas</div>
        </header>
        {firebaseEnabled && remoteOnly.length > 0 && (
          <section className="card stack" style={{ gap:10 }}>
            <div className="card-header">Baralhos na Nuvem (sem cópia local)</div>
            <div className="stack" style={{ gap:10 }}>
              {remoteOnly.map(r => (
                <div key={r.cloudId} className="answer-box" style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <strong>{r.name}</strong>
                    <span className="badge">{r.cards.length} cartas</span>
                  </div>
                  {r.audio && <span className="caption">Áudio disponível</span>}
                  <div className="inline" style={{ gap:6, flexWrap:'wrap' }}>
                    <button className="btn" type="button" onClick={()=> { const id = cloneCloudDeck(r); setExpanded(id); }}>Clonar Local</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="card stack" style={{ gap: 12 }}>
          <div className="card-header">Novo Baralho</div>
          <form className="flex-gap" onSubmit={e=>{e.preventDefault(); if(!newDeckName.trim()) return; const id = addDeck(newDeckName.trim(), []); setNewDeckName(''); setExpanded(id);} }>
            <input type="text" value={newDeckName} placeholder="Nome do baralho" onChange={e=>setNewDeckName(e.target.value)} />
            <button className="btn" type="submit">Criar</button>
          </form>
          <DeckImport hasDeck={false} onLoad={(cards)=> { const id = addDeck('Importado '+ (decks.length+1), cards); setExpanded(id); }} onClear={()=>{}} />
        </section>
        {[...decks].sort((a,b)=> a.name.localeCompare(b.name)).map(d => {
          const editing = expanded === d.id;
          const st = stats[d.id] || { attempts:0, correct:0, sessions:0 };
          const taxa = st.attempts ? Math.round(st.correct/st.attempts*100) : 0;
          return (
            <section key={d.id} className="card stack" style={{ gap: 10 }}>
              <div className="card-header inline" style={{ justifyContent:'space-between' }}>
                {editing ? (
                  <input
                    value={editingName}
                    placeholder="Nome do baralho"
                    onChange={e=> setEditingName(e.target.value)}
                    onKeyDown={e=> { if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); if(editingName.trim()){ updateDeck(d.id,{ name: editingName.trim() }); setExpanded(null); } } }}
                    autoFocus
                  />
                ) : (<span>{d.name}</span>)}
                <div className="inline" style={{ gap:6 }}>
                  <label className="inline" style={{ fontSize:12 }}>
                    <input type="checkbox" checked={d.active} onChange={e=> updateDeck(d.id,{ active: e.target.checked })} /> <span className="caption">Ativo</span>
                  </label>
                  {editing ? (
                    <>
                      <button className="btn btn-secondary" type="button" onClick={()=> { if(editingName.trim()) updateDeck(d.id,{ name: editingName.trim() }); setExpanded(null); }}>Salvar</button>
                      <button className="btn btn-ghost" type="button" onClick={()=> { setExpanded(null); }}>Cancelar</button>
                    </>
                  ) : (
                    <button className="btn btn-secondary" type="button" onClick={()=> { setExpanded(d.id); setEditingName(d.name); }}>Editar</button>
                  )}
                  <button className="btn btn-ghost" type="button" onClick={()=> deleteDeck(d.id)}>Excluir</button>
                </div>
              </div>
              <div className="caption">Cartas: {d.cards.length} · Tentativas: {st.attempts} · Taxa: {taxa}% · Sessões: {st.sessions}</div>
              {editing && (
                <div className="stack" style={{ gap: 12 }}>
                  <div className="answer-box" style={{ maxHeight: 260, overflow:'auto' }}>
                    {d.cards.map((c,i)=>(
                      <div key={i} style={{ padding:'6px 0', borderBottom:'1px solid #2f4d70', display:'flex', flexDirection:'column', gap:6 }}>
                        <input value={c.question} onChange={e=> updateCard(d.id,i,{ ...c, question: e.target.value })} />
                        <textarea rows={2} style={{ background:'#162b44', border:'1px solid #2f4d70', color:'#fff', borderRadius:4, padding:6 }} value={c.answers.join(' | ')} onChange={e=> updateCard(d.id,i,{ ...c, answers: e.target.value.split('|').map(s=>s.trim()).filter(Boolean) })} />
                        <div className="inline" style={{ justifyContent:'space-between' }}>
                          <span className="caption">Respostas separadas por |</span>
                          <button className="btn btn-ghost" type="button" onClick={()=> deleteCard(d.id,i)}>Remover</button>
                        </div>
                      </div>
                    ))}
                    {d.cards.length===0 && <div className="caption">Nenhuma carta.</div>}
                  </div>
                  <div className="stack" style={{ gap:6 }}>
                    <div className="card-header" style={{ fontSize:14 }}>Áudio da Aula (MP3)</div>
                    {!d.audio && (
                      <label style={{ fontSize:12, display:'flex', flexDirection:'column', gap:6 }}>
                        <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,.m4a,audio/*" onChange={async (e)=> {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 30 * 1024 * 1024) { alert('Arquivo muito grande (>30MB)'); return; }
                          const key = d.id + ':' + Date.now();
                          const ok = await saveAudioBlob(key, file);
                          if (!ok) { alert('Falha ao salvar áudio (IndexedDB).'); return; }
                          updateDeck(d.id,{ audio: { name: file.name, size: file.size, type: file.type || 'audio/mpeg', key } });
                        }} />
                        <span className="caption">Selecione um áudio (MP3/M4A até 30MB). Salvo localmente.</span>
                      </label>
                    )}
                    {d.audio && (
                      <div className="stack" style={{ gap:6 }}>
                        <DeckAudioPlayer meta={d.audio} onRemove={async ()=> { await deleteAudioBlob(d.audio!.key); updateDeck(d.id,{ audio: undefined }); }} />
                      </div>
                    )}
                  </div>
                  <AddCardForm deckId={d.id} />
                  <div className="actions-row" style={{ marginTop:4, flexWrap:'wrap', gap:8 }}>
                    <button className="btn" type="button" onClick={()=> { setCurrentDeckId(d.id); setIndice(0); setView('study'); setResultado(null); setRespostaEntrada(''); setOrigemUltimaEntrada(null); }}>Estudar este</button>
                    {firebaseEnabled && <button className="btn btn-secondary" type="button" onClick={()=> publishDeckFirebase(d)}>{d.cloudId? 'Atualizar Cloud' : 'Publicar Cloud'}</button>}
                    {d.published && <span className="badge">Publicado</span>}
                  </div>
                  {firebaseEnabled && d.cloudId && (
                    <div className="inline" style={{ gap:8, flexWrap:'wrap' }}>
                      <button className="btn btn-ghost" type="button" onClick={async ()=> {
                        if (!cloudDbRef.current) return alert('Firebase não pronto');
                        if (!confirm('Remover deck da nuvem? Esta ação não pode ser desfeita.')) return;
                        appendPublishLog(d.id, 'Removendo deck da nuvem...');
                        try {
                          await deleteDeckDoc(cloudDbRef.current, d.cloudId!);
                          appendPublishLog(d.id, 'Deck removido da nuvem.');
                          updateDeck(d.id, { cloudId: undefined, published: false });
                        } catch (err:any) {
                          console.error('[deleteCloudDeck] erro', err);
                          appendPublishLog(d.id, 'Erro ao remover deck cloud: ' + (err?.code||err?.message||String(err)));
                          alert('Falha ao remover deck cloud. Veja console.');
                        }
                      }}>Remover Cloud</button>
                    </div>
                  )}
                  {firebaseEnabled && (
                    <details style={{ background:'#13263b', padding:'8px 10px', borderRadius:6 }}>
                      <summary style={{ cursor:'pointer', fontSize:12 }}>Log de publicação</summary>
                      <div style={{ maxHeight:150, overflow:'auto', fontSize:11, marginTop:6, lineHeight:1.3 }}>
                        {(publishLogs[d.id] && publishLogs[d.id].length) ? publishLogs[d.id].slice(-30).map((l,i)=>(
                          <div key={i}>{l}</div>
                        )) : <div style={{ opacity:0.6 }}>Nenhum evento ainda.</div>}
                      </div>
                      <div className="inline" style={{ gap:6, marginTop:6 }}>
                        <button className="btn btn-ghost" type="button" onClick={()=> setPublishLogs(p=> ({ ...p, [d.id]: [] }))} disabled={!publishLogs[d.id] || publishLogs[d.id].length===0}>Limpar log</button>
                        <button className="btn btn-ghost" type="button" onClick={()=> publishDeckFirebase(d)}>Re-publicar</button>
                      </div>
                    </details>
                  )}
                </div>
              )}
            </section>
          );
        })}
        {decks.length === 0 && <div className="caption">Nenhum baralho ainda. Importe ou crie um novo.</div>}
      </>
    );
  };

  const HomeView = () => {
  const list = studyDeckSource.map(d=> ({ id:d.id, name:d.name, total:d.cards.length, active:d.active, published: d.published }));
    const cardStyle: React.CSSProperties = { display:'flex', flexDirection:'column', gap:6 };
    return (
      <>
        <header className="stack" style={{ gap:4 }}>
          <h1>{firebaseEnabled ? (cloudDecks.length ? 'Baralhos (Cloud)' : 'Baralhos (Local - aguardando publish)') : 'Seus Baralhos'}</h1>
          <div className="subtitle">{firebaseEnabled ? (cloudDecks.length ? 'Decks publicados disponíveis online' : 'Nenhum deck cloud ainda. Publique um baralho para aparecer aqui.') : 'Crie ou ative baralhos para estudar'}</div>
        </header>
        <div className="stack" style={{ gap:16 }}>
          {list.map(d => {
            const st = stats[d.id] || { attempts:0, correct:0, sessions:0 };
            const rate = st.attempts ? Math.round(st.correct/st.attempts*100) : 0;
            return (
              <div key={d.id} className="card" style={cardStyle}>
                <div className="card-header inline" style={{ justifyContent:'space-between' }}>
                  <span>{d.name}</span>
                  <span className="badge">{d.total} cartas</span>
                </div>
                <div className="caption">Tentativas: {st.attempts} · Acertos: {st.correct} · Taxa: {rate}% · Sessões: {st.sessions}</div>
                {d.published && <div className="caption" style={{ color:'#7ccfff' }}>Publicado</div>}
                {!d.published && firebaseEnabled && cloudDecks.length===0 && <div className="caption" style={{ color:'#ffa947' }}>Ainda não publicado</div>}
                {decks.find(x=> x.id===d.id)?.audio && <DeckAudioInline meta={decks.find(x=> x.id===d.id)!.audio!} />}
                <div className="actions-row" style={{ marginTop:4 }}>
                  <button className="btn" type="button" onClick={()=> { setCurrentDeckId(d.id); setIndice(0); setView('study'); setRespostaEntrada(''); setOrigemUltimaEntrada(null); setResultado(null); }}>Estudar</button>
                </div>
              </div>
            );
          })}
          {list.length === 0 && <div className="caption">Nenhum baralho ativo. Vá em "Baralhos" para criar ou importar.</div>}
        </div>
      </>
    );
  };

  return (
    <div className="app-container">
      {!firebaseEnabled && firebaseStatus==='Config inválida' && (
        <div style={{position:'fixed',top:0,left:0,right:0,background:'#b30000',color:'#fff',padding:'6px 10px',fontSize:12,zIndex:1000}}>
          Cloud desativado: configuração Firebase inválida (anon auth não habilitado ou domínio não autorizado). App segue offline.
        </div>
      )}
      {firebaseEnabled && firebaseStatus && firebaseStatus.startsWith('Erro') && (
        <div style={{position:'fixed',top:0,left:0,right:0,background:'#b36b00',color:'#fff',padding:'6px 10px',fontSize:12,zIndex:1000}}>
          {firebaseStatus}
        </div>
      )}
  {/* Remote progress helpers */}
  {/* Implement queue system */}
      <Nav />
      {view === 'home' && <HomeView />}
      {view === 'study' && <StudyView />}
      {view === 'settings' && <SettingsView />}
      {view === 'decks' && <DecksView />}
      {firebaseEnabled && firebaseInitDelay && !cloudDbRef.current && (
        <div style={{position:'fixed',bottom:30,left:10,right:10,background:'#2d3f53',padding:'10px 12px',border:'1px solid #44617f',borderRadius:6,fontSize:12,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
          <span>Firebase ainda não inicializado (possível atraso de rede). Tente novamente.</span>
          <button className="btn btn-secondary" type="button" onClick={forceFirebaseInit}>Reinicializar</button>
        </div>
      )}
      <footer>Kids Flashcards · Interface melhorada · v1</footer>
  {firebaseEnabled && <div style={{position:'fixed',bottom:4,right:8,fontSize:12,opacity:0.8}}>Cloud {remoteQueue.length||remoteSessionIncrement.length? '⏳':'✔'}</div>}
      <audio ref={audioOkRef} style={{ display: 'none' }} aria-hidden="true" />
      <audio ref={audioErroRef} style={{ display: 'none' }} aria-hidden="true" />
    </div>
  );
};

// ------- Remote Progress Queue (FireStore writes debounce) -------
let remoteQueue: { deckId:string; card:number; score:number; correct:boolean }[] = [];
let remoteSessionIncrement: { deckId:string }[] = [];
let flushTimer: any = null;
const flushRemote = async (db:any, userId:string) => {
  if (!remoteQueue.length && !remoteSessionIncrement.length) return;
  const grouped: Record<string, {answers:{card:number;score:number;correct:boolean}[]; sessions:number}> = {};
  remoteQueue.forEach(r => { grouped[r.deckId] = grouped[r.deckId] || { answers:[], sessions:0 }; grouped[r.deckId].answers.push(r); });
  remoteSessionIncrement.forEach(r => { grouped[r.deckId] = grouped[r.deckId] || { answers:[], sessions:0 }; grouped[r.deckId].sessions += 1; });
  remoteQueue = []; remoteSessionIncrement = [];
  for (const deckId of Object.keys(grouped)) {
    const g = grouped[deckId];
    await updateProgress(db, userId, deckId, cur => {
      const perCard = { ...(cur.perCard||{}) } as any;
      let attemptsTotal = cur.attemptsTotal || 0;
      let correctTotal = cur.correctTotal || 0;
      g.answers.forEach(a => {
        const slot = perCard[a.card] || { scores:[], attempts:0, correct:0 };
        slot.scores = [...slot.scores, a.score]; if (slot.scores.length>50) slot.scores = slot.scores.slice(-50);
        slot.attempts += 1; if (a.correct) slot.correct += 1;
        perCard[a.card] = slot;
        attemptsTotal += 1; if (a.correct) correctTotal += 1;
      });
      const sessions = (cur.sessions||0) + g.sessions;
      return { perCard, attemptsTotal, correctTotal, sessions } as any;
    });
  }
};
const scheduleFlush = (db:any, uid:string) => {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => { const ref = db; const id = uid; flushTimer = null; await flushRemote(ref, id); }, 1000);
};
const queueRemoteProgressUpdate = (deckId:string, card:number, score:number, correct:boolean) => {
  remoteQueue.push({ deckId, card, score, correct });
  // db/uid captured via closure? We expose schedule via window hook (attached in App runtime) - simplified approach omitted here.
};
const queueSessionIncrement = (deckId:string) => { remoteSessionIncrement.push({ deckId }); };

// ------- Hook de listener de progresso remoto (injetado dinamicamente) -------
// Colocamos fora para evitar redefinições; a lógica de uso está dentro do componente via efeito adicional abaixo.


