import { describe, expect, it } from 'vitest';
import { aggregateDays, bucketFor, matchPreset, presetRange, shiftRange } from './reportRange';

const TODAY = '2026-10-14';

describe('períodos dos relatórios', () => {
  it('calcula os períodos prontos', () => {
    expect(presetRange('thisWeek', TODAY, 1)).toEqual({ start: '2026-10-12', end: '2026-10-18' });
    expect(presetRange('lastWeek', TODAY, 0)).toEqual({ start: '2026-10-04', end: '2026-10-10' });
    expect(presetRange('lastMonth', TODAY, 1)).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(presetRange('lastMonth', '2026-01-10', 1)).toEqual({ start: '2025-12-01', end: '2025-12-31' });
    expect(presetRange('last30', TODAY, 1)).toEqual({ start: '2026-09-15', end: TODAY });
  });

  it('reconhece o período pronto atual', () => {
    expect(matchPreset('2026-10-01', '2026-10-31', TODAY, 1)).toBe('thisMonth');
    expect(matchPreset('2026-10-02', '2026-10-31', TODAY, 1)).toBeNull();
  });

  it('anda por semanas e por meses inteiros', () => {
    expect(shiftRange('2026-10-12', '2026-10-18', -1)).toEqual({ start: '2026-10-05', end: '2026-10-11' });
    expect(shiftRange('2026-02-01', '2026-02-28', 1)).toEqual({ start: '2026-03-01', end: '2026-03-31' });
  });

  it('agrega por semana em períodos médios', () => {
    expect(bucketFor('2026-10-01', '2026-10-31')).toBe('day');
    expect(bucketFor('2026-08-01', '2026-10-31')).toBe('week');
    expect(bucketFor('2026-01-01', '2026-12-31')).toBe('month');
    const rows = [
      { date: '2026-10-12', seconds: 10, billableSeconds: 5 },
      { date: '2026-10-14', seconds: 20, billableSeconds: 0 },
      { date: '2026-10-19', seconds: 30, billableSeconds: 30 },
    ];
    expect(aggregateDays(rows, 'week', 1)).toEqual([
      { key: '2026-10-12', seconds: 30, billableSeconds: 5 },
      { key: '2026-10-19', seconds: 30, billableSeconds: 30 },
    ]);
  });
});
