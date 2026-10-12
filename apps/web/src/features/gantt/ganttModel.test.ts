import { describe, expect, it } from 'vitest';
import { buildHeader, buildRows, computeRange, dateToX, dependencyPath, nonWorkingDays, xToDate, type HeaderLabels } from './ganttModel';

const labels: HeaderLabels = {
  month: (iso) => `M${iso.slice(5, 7)}`,
  monthShort: (iso) => `m${iso.slice(5, 7)}`,
  year: (iso) => iso.slice(0, 4),
  week: (iso) => `W${iso}`,
  day: (iso) => iso.slice(8),
};

describe('escala de tempo', () => {
  it('alinha o início à semana e cobre hoje e as tarefas', () => {
    const range = computeRange(['2026-10-20', '2026-11-05', null], '2026-10-14', 'days');
    expect(range.start).toBe('2026-10-05');
    expect(range.end).toBe('2026-11-26');
    expect(range.days).toBe(53);
  });

  it('no zoom de meses começa no dia 1', () => {
    expect(computeRange([], '2026-10-14', 'months').start).toBe('2026-09-01');
  });

  it('converte data em posição e de volta', () => {
    const range = computeRange([], '2026-10-14', 'days');
    expect(dateToX('2026-10-06', range, 36)).toBe(36);
    expect(xToDate(36 * 3 + 10, range, 36)).toBe('2026-10-08');
  });

  it('lista dias não úteis', () => {
    const range = { start: '2026-10-12', end: '2026-10-18', days: 7 };
    expect(nonWorkingDays(range, [1, 2, 3, 4, 5])).toEqual(['2026-10-17', '2026-10-18']);
  });
});

describe('cabeçalho', () => {
  it('em dias: semanas em cima e dias embaixo', () => {
    const range = { start: '2026-10-12', end: '2026-10-25', days: 14 };
    const header = buildHeader(range, 'days', labels);
    expect(header.top.map((cell) => [cell.label, cell.x, cell.width])).toEqual([
      ['W2026-10-12', 0, 252],
      ['W2026-10-19', 252, 252],
    ]);
    expect(header.bottom).toHaveLength(14);
  });

  it('em semanas: meses cortados nas bordas do intervalo', () => {
    const range = { start: '2026-10-26', end: '2026-11-08', days: 14 };
    const header = buildHeader(range, 'weeks', labels);
    expect(header.top.map((cell) => [cell.label, cell.width])).toEqual([
      ['M10', 6 * 14],
      ['M11', 8 * 14],
    ]);
  });
});

describe('linhas da árvore', () => {
  const tasks = [
    { id: '1', parentId: null, position: 2 },
    { id: '2', parentId: null, position: 1 },
    { id: '3', parentId: '1', position: 1 },
    { id: '4', parentId: '3', position: 1 },
    { id: '5', parentId: '99', position: 3 },
  ];

  it('ordena por posição, numera e marca quem tem filhos', () => {
    const rows = buildRows(tasks, new Set());
    expect(rows.map((row) => [row.task.id, row.depth, row.wbs, row.hasChildren])).toEqual([
      ['2', 0, '1', false],
      ['1', 0, '2', true],
      ['3', 1, '2.1', true],
      ['4', 2, '2.1.1', false],
      ['5', 0, '3', false],
    ]);
  });

  it('esconde a subárvore de pais recolhidos', () => {
    expect(buildRows(tasks, new Set(['1'])).map((row) => row.task.id)).toEqual(['2', '1', '5']);
  });
});

describe('setas', () => {
  it('FS com espaço faz um cotovelo só', () => {
    expect(dependencyPath('FS', { x1: 0, x2: 100, y: 18 }, { x1: 140, x2: 200, y: 54 })).toBe('M 100 18 H 110 V 54 H 140');
  });

  it('FS sem espaço contorna pela linha do meio', () => {
    expect(dependencyPath('FS', { x1: 0, x2: 100, y: 18 }, { x1: 60, x2: 200, y: 54 })).toBe(
      'M 100 18 H 110 V 36 H 50 V 54 H 60',
    );
  });

  it('SS sai e entra pela esquerda', () => {
    expect(dependencyPath('SS', { x1: 20, x2: 100, y: 18 }, { x1: 40, x2: 200, y: 54 })).toBe('M 20 18 H 10 V 36 H 30 V 54 H 40');
  });
});
