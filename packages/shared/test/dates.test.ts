import { describe, expect, it } from 'vitest';
import {
  addDays,
  addWorkdays,
  diffDays,
  eachDay,
  isIsoDate,
  isoWeekNumber,
  nextWorkday,
  startOfWeekIso,
  weekday,
  workdaysBetween,
} from '../src/dates';

const WEEK = [1, 2, 3, 4, 5];

describe('datas de calendário', () => {
  it('valida AAAA-MM-DD de verdade', () => {
    expect(isIsoDate('2026-10-12')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('12/10/2026')).toBe(false);
    expect(isIsoDate(20261012)).toBe(false);
  });

  it('soma dias atravessando mês e ano', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('não sofre com horário de verão porque não usa fuso local', () => {
    // 2018-11-04 foi o início do horário de verão no Brasil.
    expect(addDays('2018-11-03', 1)).toBe('2018-11-04');
    expect(diffDays('2018-11-03', '2018-11-05')).toBe(2);
  });

  it('calcula dia da semana e semana ISO', () => {
    expect(weekday('2026-10-12')).toBe(1);
    expect(weekday('2026-10-11')).toBe(0);
    expect(isoWeekNumber('2026-10-12')).toBe(42);
    expect(isoWeekNumber('2026-10-11')).toBe(41);
    expect(isoWeekNumber('2027-01-01')).toBe(53);
  });

  it('acha o início da semana conforme a preferência', () => {
    expect(startOfWeekIso('2026-10-14', 1)).toBe('2026-10-12');
    expect(startOfWeekIso('2026-10-14', 0)).toBe('2026-10-11');
    expect(startOfWeekIso('2026-10-11', 1)).toBe('2026-10-05');
  });

  it('lista os dias do intervalo fechado', () => {
    expect(eachDay('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });
});

describe('dias úteis', () => {
  it('pula fim de semana ao procurar o próximo dia útil', () => {
    expect(nextWorkday('2026-10-17', WEEK)).toBe('2026-10-19');
    expect(nextWorkday('2026-10-16', WEEK)).toBe('2026-10-16');
  });

  it('soma dias úteis para frente e para trás', () => {
    expect(addWorkdays('2026-10-16', 1, WEEK)).toBe('2026-10-19');
    expect(addWorkdays('2026-10-12', 5, WEEK)).toBe('2026-10-19');
    expect(addWorkdays('2026-10-19', -1, WEEK)).toBe('2026-10-16');
    expect(addWorkdays('2026-10-18', 0, WEEK)).toBe('2026-10-19');
  });

  it('conta dias úteis num intervalo', () => {
    expect(workdaysBetween('2026-10-12', '2026-10-16', WEEK)).toBe(5);
    expect(workdaysBetween('2026-10-12', '2026-10-25', WEEK)).toBe(10);
    expect(workdaysBetween('2026-10-17', '2026-10-18', WEEK)).toBe(0);
    expect(workdaysBetween('2026-10-16', '2026-10-12', WEEK)).toBe(0);
  });

  it('não entra em laço infinito sem dias úteis configurados', () => {
    expect(nextWorkday('2026-10-17', [])).toBe('2026-10-17');
    expect(addWorkdays('2026-10-17', 2, [])).toBe('2026-10-19');
  });
});
