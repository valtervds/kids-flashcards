import React, { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react';
// Removido: legado cloudSync substituído por fluxo Firebase moderno
import { resolveFirebaseConfig } from './firebase/defaultConfig';
// Fase 1 Firebase infra (usado progressivamente). Variáveis esperadas via Vite env:
// import.meta.env.VITE_FB_API_KEY etc. Integração completa ocorrerá em fases.
import { MascoteTTS } from './components/MascoteTTS';
import { Stars } from './components/Stars';
import { avaliar, respostasCorretas, normalizar } from './evaluation';
import { Deck, DeckAudioMeta, DeckVideoMeta, Flashcard, DeckStats, ProgressMap } from './domain/models';
import { gerarDica, obterRespostaCorretaPreferida } from './utils/scoring';
import { useLocalDecks } from './features/decks/useLocalDecks';
import { useProgress } from './features/study/hooks/useProgress';
import { useStudySession } from './features/study/hooks/useStudySession'; // legacy (some parts moved to useStudyEngine)
import { useStats } from './features/study/hooks/useStats';
import { useAudioFeedback } from './features/study/hooks/useAudioFeedback';
import { useAnswerEvaluation } from './features/study/hooks/useAnswerEvaluation'; // still used inside engine
import { useStudyEngine } from './features/study/hooks/useStudyEngine';
import { ToastProvider, ToastContainer, useToast } from './components/ui/Toast';
import { usePublishService } from './services/publish';
import { DeckProvider, useDeckContext } from './contexts/DeckContext';
import { CloudProvider, useCloudContext } from './contexts/CloudContext';
import { HomeView, SettingsView, DecksView } from './components/views';
import { Nav } from './components/Nav';
import { useAudioStorage } from './services/media/audioStorage';
import { DeckAudioPlayer, DeckAudioInline } from './components/media/DeckAudio';
import { DeckVideoPlayer, ManualRemoteVideoInput } from './components/media/DeckVideo';
import { ManualRemoteAudioInput } from './components/media/ManualRemoteAudioInput';
import { SpeechRecognition } from './components/input/SpeechRecognition';
import { useFirebaseConfig, useFirebaseState, firebaseUtils } from './services/firebase/firebaseUtils';
// Code-splitting StudyView (carrega imediatamente em ambiente de teste para simplificar testes)
let StudyView: React.ComponentType<any>;
if (process.env.NODE_ENV === 'test') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  StudyView = require('./features/study/StudyView').StudyView;
} else {
  StudyView = lazy(() => import('./features/study/StudyView').then(m => ({ default: m.StudyView })));
}
import { useRemoteProgressQueue } from './features/study/hooks/useRemoteProgressQueue';
import { DeckImport } from './components/DeckImport';
// Imports estáticos para evitar falhas de carregamento dinâmico em GitHub Pages (chunks 404)
import { createDeck, updateDeckDoc, listenPublishedDecks, deleteDeckDoc } from './firebase/decksRepo';
import { uploadDeckAudio } from './firebase/storage';
import { listenProgress, updateProgress } from './firebase/progressRepo';
import { createDeckMedia } from './firebase/deckMediaRepo';

// ------------------------------- App Principal -----------------------------
const AppContent: React.FC = () => {
  const { showToast } = useToast();
  const defaultPerguntas = process.env.NODE_ENV === 'test' ? [
    'Qual é a capital do Brasil?',
    'Quanto é 3 + 4?',
    'O que é um flashcard?'
  ] : [];

  // Estrutura multi-deck (tipos movidos para domain/models)

  // Use audio storage hook
  const { saveAudioBlob, loadAudioBlob, deleteAudioBlob, getAudioObjectUrl, clearAudioCache } = useAudioStorage();

  // DeckStats movido para domain/models

  // Decks locais via hook
  const { decks, setDecks } = useLocalDecks();

  const { stats, recordAttempt, recordSession } = useStats();

  // Estado de decks cloud precisa existir antes de qualquer função que o utilize (evita TDZ)
  // Cloud decks agora opcional; evitamos acesso durante render inicial para eliminar risco de TDZ em bundle inconsistente
  const cloudStateRef = useRef<{ decks: Deck[]; loaded: boolean }>({ decks: [], loaded: false });
  const [cloudTick, setCloudTick] = useState(0); // força re-render quando cloudStateRef muta
  const cloudDecks = cloudStateRef.current.decks;
  const cloudDecksLoaded = cloudStateRef.current.loaded;

  const [currentDeckId, setCurrentDeckId] = useState<string>('default');
  const getCurrentDeck = () => {
    // Defensive against rare TDZ/ordering race in dev/preview with cached chunks
    try {
      if (currentDeckId === 'default') return null;
      return decks.find(d => d.id === currentDeckId) || null; // estudo somente local
    } catch (e:any) {
      if (e && e.name === 'ReferenceError') {
        console.warn('[getCurrentDeck:ReferenceError]', e);
      } else {
        console.warn('[getCurrentDeck:error]', e);
      }
      return null;
    }
  };
  const usandoDeckImportado = !!getCurrentDeck();
  const perguntas = getCurrentDeck() ? getCurrentDeck()!.cards.map(c => c.question) : defaultPerguntas; // kept for backward compatibility (engine also derives)
  // Áudio do baralho agora exibido somente na Home (player removido do modo Estudar)

  // Estados principais
  const [view, setView] = useState<'home' | 'study' | 'settings' | 'decks'>(() => process.env.NODE_ENV === 'test' ? 'study' : 'home');
  // (engine movido para após definição de dependências: firebaseEnabled, remoteQueueApi, safePlay, progress)
  const [sonsAtivos, setSonsAtivos] = useState(true);
  const { audioOkRef, audioErroRef, safePlay, audioPronto } = useAudioFeedback(sonsAtivos);
  // Ref simples para marcar primeira interação de áudio
  const primeiraInteracaoRef = useRef(false);
  // inicioPerguntaTs agora interno ao engine
  // Histórico de pontuações por deck/cartão via hook dedicado
  const { progress, setProgress } = useProgress();
  // mostrarHistorico agora controlado pelo engine
  // --------- Cloud Sync State ---------
  // Cloud sync legado removido

  // Firebase configuration and state
  const { firebaseEnv, firebaseAvailable } = useFirebaseConfig();
  const {
    firebaseEnabled,
    setFirebaseEnabled,
    firebaseStatus,
    setFirebaseStatus,
    firebaseUid,
    setFirebaseUid,
    firebaseInitDelay,
    setFirebaseInitDelay,
    cloudDbRef,
    cloudStorageRef,
    forceFirebaseInit
  } = useFirebaseState();
  const remoteQueueApi = useRemoteProgressQueue({ enabled: firebaseEnabled, dbRef: cloudDbRef, userId: firebaseUid });
  // Debug: loga uma única vez para detectar possíveis problemas de ordem em build minificado
  const loggedRemoteQueueRef = useRef(false);
  if (!loggedRemoteQueueRef.current) {
    // eslint-disable-next-line no-console
    console.log('[debug] remoteQueueApi init', Object.keys(remoteQueueApi));
    loggedRemoteQueueRef.current = true;
  }
  // Efeito de migração de seleção para id cloud quando disponível
  // Migração de id cloud desativada temporariamente enquanto isolamos erro de TDZ
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
  const mapped = firebaseUtils.mapCloudDecksToLocal(list);
        cloudStateRef.current.decks = mapped;
        cloudStateRef.current.loaded = true;
        setCloudTick(t=>t+1);
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
  useEffect(()=> {
    const t = setTimeout(()=> {
      if (firebaseEnabled && !cloudDbRef.current) setFirebaseInitDelay(true);
    }, 5000);
    return ()=> clearTimeout(t);
  }, [firebaseEnabled]);
  
  const forceFirebaseInitLocal = () => {
    if (!cloudDbRef.current) {
      appendPublishLog('global','Forçando init Firebase...');
      initFirebaseFull();
    }
  };
  // Flush pendente ao fechar/ocultar
  useEffect(() => {
    if (!remoteQueueApi) return; // proteção extra (não deve ocorrer)
    const handler = () => { if (firebaseEnabled && firebaseUid && cloudDbRef.current) { try { remoteQueueApi.flush(); } catch (e) { console.warn('[remoteQueue.flush.error]', e); } } };
    window.addEventListener('beforeunload', handler);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') handler(); });
    return () => { window.removeEventListener('beforeunload', handler); }; // visibilitychange não precisa remover
  }, [firebaseEnabled, firebaseUid, remoteQueueApi]);

  // Listener progresso remoto (decks cloud)
  useEffect(() => {
    if (!firebaseEnabled || !firebaseUid || !cloudDbRef.current) {
      Object.values(remoteUnsubsRef.current).forEach(u => u());
      remoteUnsubsRef.current = {};
      return;
    }
    (async () => {
      const ids = new Set<string>();
      cloudStateRef.current.decks.forEach(d => d.cloudId && ids.add(d.cloudId));
      decks.forEach(d => d.cloudId && ids.add(d.cloudId));
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
            const localDeck = decks.find(d => d.cloudId === id);
            if (!localDeck) return { ...prev, [id]: mapped };
            return { ...prev, [localDeck.id]: mapped };
          });
        });
        remoteUnsubsRef.current[id] = unsub;
      });
    })();
  }, [firebaseEnabled, firebaseUid, cloudDbRef.current, decks, cloudTick]);
  
  const publishDeckFirebase = async (deck: Deck) => {
    if (!firebaseEnabled) {
      showToast('error', 'Firebase não habilitado');
      return;
    }
    if (!cloudDbRef.current) {
      showToast('error', 'Firebase não pronto');
      return;
    }
    if (!deck.cards.length) {
      appendPublishLog(deck.id, 'Publicação cancelada: baralho vazio.');
      showToast('error', 'Baralho vazio', 'Adicione pelo menos 1 carta antes de publicar.');
      return;
    }
    try {
      console.log('[publishDeckFirebase] iniciando', { deckId: deck.id, cloudId: deck.cloudId, name: deck.name });
      appendPublishLog(deck.id, 'Iniciando publicação...');
      setFirebaseStatus('Publicando...');
      // Garante que temos UID válido (anonymous auth) antes de escrever
      if (!firebaseUid) {
        appendPublishLog(deck.id, 'Obtendo autenticação anônima...');
        try {
          const { ensureAnonymousAuth } = await import('./firebase/app');
          const uid = await ensureAnonymousAuth();
          setFirebaseUid(uid);
          appendPublishLog(deck.id, 'Auth OK (uid=' + uid + ').');
        } catch (e:any) {
          appendPublishLog(deck.id, 'Falha auth: ' + (e?.code || e?.message || String(e)));
          showToast('error', 'Erro de autenticação', 'Não foi possível autenticar (anônimo).');
          return;
        }
      }
      if (!firebaseUid) {
        appendPublishLog(deck.id, 'UID ausente após tentativa de auth. Abortando.');
        showToast('error', 'UID não disponível para publicar.');
        return;
      }
      let cloudId = deck.cloudId;
      if (!cloudId) {
        cloudId = await createDeck(cloudDbRef.current, { ownerId: firebaseUid, name: deck.name, active: deck.active, published: true, cards: deck.cards });
        updateDeck(deck.id, { cloudId, published: true });
        console.log('[publishDeckFirebase] deck criado', { cloudId });
        appendPublishLog(deck.id, `Deck criado na nuvem (id=${cloudId}).`);
      } else {
        await updateDeckDoc(cloudDbRef.current, cloudId, { name: deck.name, active: deck.active, published: true, cards: deck.cards });
        console.log('[publishDeckFirebase] deck atualizado', { cloudId });
        appendPublishLog(deck.id, `Deck atualizado (id=${cloudId}).`);
      }
      if (deck.audio) {
        // Caso 1: áudio local (blob em IndexedDB) -> upload
        const isRemoteUrl = deck.audio.key.startsWith('http');
        if (!isRemoteUrl && cloudStorageRef.current) {
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
          } else {
            appendPublishLog(deck.id, 'Áudio local não encontrado para upload (IndexedDB) chave '+ deck.audio.key);
          }
        } else if (isRemoteUrl) {
          // Caso 2: URL direta já hospedada -> apenas salva metadata apontando para downloadUrl
            await updateDeckDoc(cloudDbRef.current, cloudId!, { audioMeta: { fileName: deck.audio.name, storagePath: deck.audio.key, downloadUrl: deck.audio.downloadUrl || deck.audio.key, contentType: deck.audio.type, size: deck.audio.size }, published: true });
            appendPublishLog(deck.id, 'Áudio remoto (URL) referenciado sem upload.');
        }
      }
      // Publicar relação de vídeo se existir (URL remota). Por ora não faz upload, apenas referência.
      if (deck.video && deck.video.key.startsWith('http')) {
        try {
          appendPublishLog(deck.id, 'Registrando vídeo...');
          await createDeckMedia(cloudDbRef.current, { deckId: cloudId!, ownerId: firebaseUid, kind: 'video', url: deck.video.downloadUrl || deck.video.remotePath || deck.video.key, contentType: deck.video.type, posterUrl: (deck.video as any).posterUrl });
          appendPublishLog(deck.id, 'Vídeo registrado.');
        } catch (e:any) {
          appendPublishLog(deck.id, 'Falha registrar vídeo: ' + (e?.code||e?.message||String(e)));
        }
      }
      setFirebaseStatus('Publicado');
      console.log('[publishDeckFirebase] finalizado com sucesso');
      appendPublishLog(deck.id, 'Publicação concluída com sucesso.');
      showToast('success', 'Publicação concluída', 'Deck publicado na nuvem com sucesso.');
    } catch (e:any) {
      console.error('[publishDeckFirebase] erro', e);
      const code = e?.code || e?.message || String(e);
      setFirebaseStatus('Erro publicar');
      appendPublishLog(deck.id, 'Erro: ' + code);
      if (String(code).includes('permission-denied') || String(code).includes('Missing or insufficient permissions')) {
        appendPublishLog(deck.id, 'Permission denied: confirme que ownerId == request.auth.uid e regras permitem create/update.');
        appendPublishLog(deck.id, 'Debug: uid atual=' + firebaseUid + ' cloudId=' + (deck.cloudId||'-'));
      }
      showToast('error', 'Erro na publicação', 'Falha ao publicar deck. Código: ' + code);
    }
  };
  // Fallback: enquanto nenhum deck cloud carregado ainda, continua mostrando decks locais ativos
  // Nova abordagem: estudo somente em decks locais (inclui clones de cloud)
  const studyDeckSource = decks.filter(d => d.active);

  // Se usuário entra em Estudar sem deck selecionado, escolhe primeiro ativo (recupera UX anterior)
  useEffect(() => {
    if (view === 'study' && currentDeckId === 'default') {
      const first = studyDeckSource[0];
      if (first) {
        setCurrentDeckId(first.id);
        // reset estados de estudo
        setIndice(0);
        setRespostaEntrada('');
        setOrigemUltimaEntrada(null);
        setMostrarRespostaCorreta(false);
        setRevelarQtde(0);
      }
    }
  }, [view, currentDeckId, studyDeckSource]);

  // Áudio agora via hook useAudioFeedback

  // Helpers de dica e resposta correta movidos para utils/scoring

  // Hook de avaliação extraído (lote 5)
  // Lógica de próxima pergunta e submissão agora no engine
  const engine = useStudyEngine({
    getCurrentDeck,
    defaultPerguntas,
    usandoDeckImportado,
    firebaseEnabled,
    firebaseUid,
    cloudDbRef,
    recordAttempt: (deckId, correto) => recordAttempt(deckId, correto),
    recordSession,
    setProgress,
    remoteQueueApi,
    safePlay
  });
  const {
    indice, setIndice,
    respostaEntrada, setRespostaEntrada,
    origemUltimaEntrada, setOrigemUltimaEntrada,
    resultado,
    autoAvaliarVoz, setAutoAvaliarVoz,
    revelarQtde, setRevelarQtde,
    mostrarRespostaCorreta, setMostrarRespostaCorreta,
    mostrarHistorico, setMostrarHistorico,
    ultimoTempoRespostaMs,
    submeter, proximaPergunta,
    deckKeyForHistory,
    obterRespostaCorreta,
  gerarDicaComputed,
  obterRespostasTodas
  } = engine as any;

  // Auto-avaliar quando chegar voz
  useEffect(() => { /* auto avaliação tratada após final de voz */ }, []);

  // StudyView agora componente externo (lote 5). Mantemos lógica de voz e formulário aqui e passamos via props customizadas.
  // helpers deckKeyForHistory / obterRespostaCorreta / gerarDicaComputed agora vindos do engine

  // Wrapper renomeado para evitar sombra do componente importado StudyView (causava recursão e travamento)
  const StudyViewContainer = () => (
  <StudyView
      // checkpoint mount
      {...(process.env.NODE_ENV !== 'production' ? { 'data-checkpoint': 'StudyViewMounted' } : {})}
      perguntas={perguntas}
      indice={indice}
      setIndice={setIndice}
      respostaEntrada={respostaEntrada}
      setRespostaEntrada={setRespostaEntrada}
      origemUltimaEntrada={origemUltimaEntrada}
      setOrigemUltimaEntrada={setOrigemUltimaEntrada}
      autoAvaliarVoz={autoAvaliarVoz}
      setAutoAvaliarVoz={setAutoAvaliarVoz}
      revelarQtde={revelarQtde}
      setRevelarQtde={setRevelarQtde}
      mostrarRespostaCorreta={mostrarRespostaCorreta}
      setMostrarRespostaCorreta={setMostrarRespostaCorreta}
      submeter={() => submeter('manual')}
      proximaPergunta={proximaPergunta}
      gerarAudioTTS={<MascoteTTS texto={perguntas[indice]} showVoiceSelector={false} />}
      usandoDeckImportado={usandoDeckImportado}
      getCurrentDeck={getCurrentDeck}
      resultado={resultado as any}
      mostrarHistorico={mostrarHistorico}
      setMostrarHistorico={setMostrarHistorico as any}
      progress={progress}
      currentDeckId={currentDeckId}
      respostasCorretas={respostasCorretas}
      deckKeyForHistory={deckKeyForHistory}
      obterRespostaCorreta={obterRespostaCorreta}
      gerarDicaComputed={gerarDicaComputed}
  obterRespostasTodas={obterRespostasTodas}
  loadingDeck={false}
  ultimoTempoRespostaMs={ultimoTempoRespostaMs}
  onSimularVoz={(texto) => { setRespostaEntrada(texto); setOrigemUltimaEntrada('voz'); if(autoAvaliarVoz) submeter('voz'); }}
  ReconhecimentoVozSlot={<SpeechRecognition onResult={(texto, final) => { setRespostaEntrada(texto); setOrigemUltimaEntrada('voz'); if (final && autoAvaliarVoz) submeter('voz'); }} />}
    />
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

  // Estado para pré-visualização de vídeo
  const [previewVideo, setPreviewVideo] = useState<DeckVideoMeta|null>(null);

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
      <Nav view={view} setView={setView} />
      {view === 'home' && (
        <HomeView
          stats={stats}
          setCurrentDeckId={setCurrentDeckId}
          setIndice={setIndice}
          setView={setView}
          setRespostaEntrada={setRespostaEntrada}
          setOrigemUltimaEntrada={setOrigemUltimaEntrada}
          setMostrarRespostaCorreta={setMostrarRespostaCorreta}
          setRevelarQtde={setRevelarQtde}
          setPreviewVideo={setPreviewVideo}
        />
      )}
      {view === 'study' && (
        (process.env.NODE_ENV === 'test')
          ? <StudyViewContainer />
          : <Suspense fallback={<div style={{padding:20}}>Carregando estudo...</div>}><StudyViewContainer /></Suspense>
      )}
      {view === 'settings' && (
        <SettingsView
          sonsAtivos={sonsAtivos}
          setSonsAtivos={setSonsAtivos}
          autoAvaliarVoz={autoAvaliarVoz}
          setAutoAvaliarVoz={setAutoAvaliarVoz}
          audioPronto={audioPronto}
          primeiraInteracaoRef={primeiraInteracaoRef}
          safePlay={safePlay}
        />
      )}
      {view === 'decks' && (
        <DecksView
          stats={stats}
          setCurrentDeckId={setCurrentDeckId}
          setIndice={setIndice}
          setView={setView}
          setRespostaEntrada={setRespostaEntrada}
          setOrigemUltimaEntrada={setOrigemUltimaEntrada}
          setMostrarRespostaCorreta={setMostrarRespostaCorreta}
          setRevelarQtde={setRevelarQtde}
          publishLogs={publishLogs}
          appendPublishLog={appendPublishLog}
          setPublishLogs={setPublishLogs}
        />
      )}
      {previewVideo && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', zIndex:3000, padding:20 }} onClick={()=> setPreviewVideo(null)}>
          <div style={{ background:'#13263b', padding:12, borderRadius:8, maxWidth:'90%', width:800, boxShadow:'0 4px 18px rgba(0,0,0,0.4)' }} onClick={e=> e.stopPropagation()}>
            <div className="inline" style={{ justifyContent:'space-between', marginBottom:8 }}>
              <strong style={{ fontSize:14, maxWidth:'70%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{previewVideo.name}</strong>
              <button className="btn btn-ghost" type="button" onClick={()=> setPreviewVideo(null)}>Fechar</button>
            </div>
            <video controls autoPlay style={{ width:'100%', maxHeight:'70vh', background:'#000' }} poster={previewVideo.posterUrl} src={previewVideo.downloadUrl || previewVideo.remotePath || previewVideo.key} />
            <div className="caption" style={{ wordBreak:'break-all', marginTop:6 }}>{previewVideo.downloadUrl || previewVideo.remotePath || previewVideo.key}</div>
          </div>
        </div>
      )}
      {firebaseEnabled && firebaseInitDelay && !cloudDbRef.current && (
        <div style={{position:'fixed',bottom:30,left:10,right:10,background:'#2d3f53',padding:'10px 12px',border:'1px solid #44617f',borderRadius:6,fontSize:12,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
          <span>Firebase ainda não inicializado (possível atraso de rede). Tente novamente.</span>
          <button className="btn btn-secondary" type="button" onClick={forceFirebaseInitLocal}>Reinicializar</button>
        </div>
      )}
      <footer>Kids Flashcards · Interface melhorada · v1</footer>
  {firebaseEnabled && <div style={{position:'fixed',bottom:4,right:8,fontSize:12,opacity:0.8}}>Cloud {remoteQueueApi.hasPending()? '⏳':'✔'}</div>}
      <audio ref={audioOkRef} style={{ display: 'none' }} aria-hidden="true" />
      <audio ref={audioErroRef} style={{ display: 'none' }} aria-hidden="true" />
    </div>
  );
};

// Main App component with providers
export const App: React.FC = () => {
  return (
    <ToastProvider>
      <DeckProvider>
        <AppContentWithContexts />
      </DeckProvider>
    </ToastProvider>
  );
};

const AppContentWithContexts: React.FC = () => {
  const { updateDeck } = useDeckContext();
  
  return (
    <CloudProvider updateDeck={updateDeck}>
      <AppContentWithToasts />
    </CloudProvider>
  );
};

const AppContentWithToasts: React.FC = () => {
  const { toasts, dismissToast } = useToast();
  
  return (
    <>
      <AppContent />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
};