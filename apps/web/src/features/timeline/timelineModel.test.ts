import { describe, expect, it } from 'vitest';
import { packLanes } from './timelineModel';

describe('empilhamento de barras', () => {
  it('coloca sobrepostas em subfaixas e reaproveita a livre', () => {
    const { lanes, count } = packLanes([
      { id: '1', start: '2026-10-12', end: '2026-10-16' },
      { id: '2', start: '2026-10-14', end: '2026-10-20' },
      { id: '3', start: '2026-10-17', end: '2026-10-18' },
      { id: '4', start: '2026-10-21', end: '2026-10-21' },
    ]);
    expect(Object.fromEntries(lanes)).toEqual({ 1: 0, 2: 1, 3: 0, 4: 0 });
    expect(count).toBe(2);
  });

  it('tarefa que começa no dia em que outra termina não cabe na mesma subfaixa', () => {
    const { count } = packLanes([
      { id: '1', start: '2026-10-12', end: '2026-10-14' },
      { id: '2', start: '2026-10-14', end: '2026-10-15' },
    ]);
    expect(count).toBe(2);
  });
});
