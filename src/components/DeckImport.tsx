import React, { useRef, useState } from 'react';

export interface Flashcard { question: string; answers: string[]; }

interface DeckImportProps {
  onLoad: (cards: Flashcard[]) => void;
  onClear: () => void;
  hasDeck: boolean;
}

function parseCsv(text: string): Flashcard[] {
  const linhas = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const cards: Flashcard[] = [];
  for (const linha of linhas) {
    const [q, a] = linha.split(/,(.+)/);
    if (!q || !a) continue;
    const answers = a.split('|').map(s => s.trim()).filter(Boolean);
    if (answers.length) cards.push({ question: q.trim(), answers });
  }
  return cards;
}

function parseJson(text: string): Flashcard[] {
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
      return data.filter(c => c && typeof c.question === 'string' && Array.isArray(c.answers))
        .map(c => ({ question: c.question, answers: c.answers.map((x: any) => String(x)) }));
    }
    if (data && Array.isArray(data.cards)) {
      return data.cards.filter(c => c && typeof c.question === 'string' && Array.isArray(c.answers))
        .map(c => ({ question: c.question, answers: c.answers.map((x: any) => String(x)) }));
    }
  } catch { /* ignore */ }
  return [];
}

export const DeckImport: React.FC<DeckImportProps> = ({ onLoad, hasDeck, onClear }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setErro(null); setResumo(null);
    try {
      const text = await file.text();
      let cards: Flashcard[] = [];
      if (/\.json$/i.test(file.name)) cards = parseJson(text);
      else if (/\.csv$/i.test(file.name)) cards = parseCsv(text);
      else { cards = parseJson(text); if (!cards.length) cards = parseCsv(text); }
      if (!cards.length) { setErro('Arquivo sem cartões válidos. Use JSON ou CSV.'); return; }
      onLoad(cards);
      setResumo(`${cards.length} cartas importadas.`);
    } catch (e: any) {
      setErro('Falha ao ler arquivo: ' + (e?.message || 'desconhecido'));
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const exemplo = () => {
    const sample: Flashcard[] = [
      { question: 'Capital da França?', answers: ['paris'] },
      { question: 'Cor primária que mistura azul e amarelo?', answers: ['verde'] },
      { question: 'Planeta conhecido como Planeta Vermelho?', answers: ['marte'] }
    ];
    onLoad(sample);
    setErro(null);
    setResumo(`${sample.length} cartas (exemplo).`);
  };

  return (
    <div className="card stack" style={{ gap: 12 }}>
      <div className="card-header inline" style={{ justifyContent: 'space-between' }}>
        <span>Importar Baralho</span>
        {hasDeck && <span className="badge">Ativo</span>}
      </div>
      <div className="caption">Carregue um JSON ou CSV para usar suas próprias perguntas.</div>
      <div className="actions-row">
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          style={{ display: 'none' }}
          onChange={onChange}
        />
        <button className="btn" type="button" onClick={() => fileRef.current?.click()}>Selecionar arquivo</button>
        <button className="btn btn-secondary" type="button" onClick={exemplo}>Exemplo</button>
        {hasDeck && <button className="btn btn-ghost" type="button" onClick={() => { onClear(); setResumo(null); }}>Limpar</button>}
      </div>
      {resumo && <div className="answer-box" style={{ background:'#1a3a5a' }}>{resumo}</div>}
      {erro && <div className="answer-box" style={{ background:'#4a1d2a', borderColor:'#7f1d1d', color:'#fecaca' }}>Erro: {erro}</div>}
      <details style={{ fontSize: 12 }}>
        <summary style={{ cursor: 'pointer' }}>Formato esperado</summary>
        <div className="caption" style={{ marginTop: 6, lineHeight: 1.4 }}>
          JSON: [{'{'}"question":"Pergunta?","answers":["resp1","resp2"]{'}'}] ou {'{'}"cards":[...] {'}'}<br />
          CSV: pergunta,resp1|resp2|resp3<br />
          Respostas múltiplas aumentam chance de acerto.
        </div>
      </details>
    </div>
  );
};
