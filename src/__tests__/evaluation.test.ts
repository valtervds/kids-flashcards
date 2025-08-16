import { normalizar, avaliar } from '../evaluation';

describe('Avaliação e normalização', () => {
  test('remove acentos e pontuação', () => {
    expect(normalizar('Brasília!')).toBe('brasilia');
  });
  test('correspondência exata retorna score 5', () => {
    const r = avaliar(0, 'Brasília');
    expect(r.correto).toBe(true);
    expect(r.score).toBe(5);
  });
  test('similaridade média gera score >=3', () => {
    const r = avaliar(2, 'cartao estudo');
    expect(r.correto).toBe(false);
    expect(r.score).toBeGreaterThanOrEqual(3);
  });
  test('resposta distante gera score 1', () => {
    const r = avaliar(0, 'banana');
    expect(r.correto).toBe(false);
    expect(r.score).toBe(1);
  });
});
