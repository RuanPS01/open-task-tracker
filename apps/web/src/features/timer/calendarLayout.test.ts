import { describe, expect, it } from 'vitest';
import { layoutDay, segmentForDay, snapMinutes } from './calendarLayout';

describe('recorte por dia', () => {
  const day = new Date(2026, 9, 12);
  it('mantém apontamento dentro do dia', () => {
    expect(segmentForDay('1', new Date(2026, 9, 12, 9), new Date(2026, 9, 12, 10, 30), day)).toEqual({
      id: '1',
      startMin: 540,
      endMin: 630,
    });
  });

  it('corta o que passa da meia-noite e ignora outro dia', () => {
    expect(segmentForDay('1', new Date(2026, 9, 12, 23), new Date(2026, 9, 13, 1), day)).toEqual({
      id: '1',
      startMin: 1380,
      endMin: 1440,
    });
    expect(segmentForDay('1', new Date(2026, 9, 11, 23), new Date(2026, 9, 12, 1), day)!.startMin).toBe(0);
    expect(segmentForDay('1', new Date(2026, 9, 13, 9), new Date(2026, 9, 13, 10), day)).toBeNull();
  });
});

describe('colunas de sobreposição', () => {
  it('apontamentos separados usam a largura toda', () => {
    const placed = layoutDay([
      { id: '1', startMin: 60, endMin: 120 },
      { id: '2', startMin: 120, endMin: 180 },
    ]);
    expect(placed.map((p) => [p.id, p.column, p.columns])).toEqual([
      ['1', 0, 1],
      ['2', 0, 1],
    ]);
  });

  it('sobrepostos dividem a largura e reaproveitam coluna livre', () => {
    const placed = layoutDay([
      { id: '1', startMin: 60, endMin: 240 },
      { id: '2', startMin: 90, endMin: 120 },
      { id: '3', startMin: 150, endMin: 200 },
    ]);
    const byId = Object.fromEntries(placed.map((p) => [p.id, [p.column, p.columns]]));
    expect(byId).toEqual({ 1: [0, 2], 2: [1, 2], 3: [1, 2] });
  });

  it('considera altura mínima para apontamentos curtos', () => {
    const placed = layoutDay([
      { id: '1', startMin: 60, endMin: 61 },
      { id: '2', startMin: 70, endMin: 90 },
    ]);
    expect(placed.find((p) => p.id === '2')!.columns).toBe(2);
  });
});

describe('encaixe na grade', () => {
  it('arredonda para 15 minutos', () => {
    expect(snapMinutes(7)).toBe(0);
    expect(snapMinutes(8)).toBe(15);
    expect(snapMinutes(52)).toBe(45);
  });
});
