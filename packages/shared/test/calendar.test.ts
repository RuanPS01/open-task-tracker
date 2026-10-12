import { describe, expect, it } from 'vitest';
import { capacityInRange, computeAllocations } from '../src/capacity';
import { addWorkdays, ALL_DAYS, isHoliday, isWorkday, nextWorkday, workdaysBetween, type WorkCalendar } from '../src/dates';
import { brazilianHolidays, easterSunday } from '../src/holidays';
import { cascadeSchedule, computeCriticalPath, workdayDuration } from '../src/scheduling';

// Semana de 12 a 16 de outubro de 2026 com o feriado de Nossa Senhora Aparecida (seg 12).
const CAL: WorkCalendar = { workingDays: [1, 2, 3, 4, 5], holidays: new Set(['2026-10-12']) };

describe('calendário com feriados', () => {
  it('feriado não é dia útil, mesmo caindo em dia útil da semana', () => {
    expect(isWorkday('2026-10-12', CAL)).toBe(false);
    expect(isHoliday('2026-10-12', CAL)).toBe(true);
    expect(isWorkday('2026-10-13', CAL)).toBe(true);
    expect(nextWorkday('2026-10-10', CAL)).toBe('2026-10-13');
  });

  it('conta e soma dias úteis pulando o feriado', () => {
    expect(workdaysBetween('2026-10-12', '2026-10-16', CAL)).toBe(4);
    expect(workdaysBetween('2026-10-12', '2026-10-16', [1, 2, 3, 4, 5])).toBe(5);
    expect(addWorkdays('2026-10-09', 1, CAL)).toBe('2026-10-13');
  });

  it('feriado no fim de semana não desconta duas vezes', () => {
    const weekend: WorkCalendar = { workingDays: [1, 2, 3, 4, 5], holidays: new Set(['2026-10-17']) };
    expect(workdaysBetween('2026-10-12', '2026-10-18', weekend)).toBe(5);
  });

  it('não entra em laço infinito se todo dia for feriado', () => {
    const blocked: WorkCalendar = { workingDays: [1], holidays: new Set(['2026-10-12', '2026-10-19']) };
    expect(nextWorkday('2026-10-12', blocked)).toBe('2026-10-26');
  });

  it('ALL_DAYS trata todo dia como útil', () => {
    expect(isWorkday('2026-10-17', ALL_DAYS)).toBe(true);
    expect(workdaysBetween('2026-10-12', '2026-10-18', ALL_DAYS)).toBe(7);
  });
});

describe('feriados nacionais do Brasil', () => {
  it('calcula a Páscoa', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2025)).toBe('2025-04-20');
    expect(easterSunday(2027)).toBe('2027-03-28');
  });

  it('lista os feriados oficiais e, se pedido, os pontos facultativos', () => {
    const official = brazilianHolidays(2026);
    expect(official.map((h) => h.date)).toContain('2026-04-03');
    expect(official.map((h) => h.date)).toContain('2026-11-20');
    expect(official.some((h) => h.optional)).toBe(false);
    const all = brazilianHolidays(2026, true).map((h) => h.date);
    expect(all).toEqual(expect.arrayContaining(['2026-02-16', '2026-02-17', '2026-06-04']));
    expect(brazilianHolidays(2023).some((h) => h.date === '2023-11-20')).toBe(false);
  });
});

describe('tarefa liberada para fins de semana e feriados', () => {
  const base = { parentId: null, isMilestone: false };

  it('conta duração em dias corridos', () => {
    const task = { ...base, startDate: '2026-10-16', dueDate: '2026-10-18' };
    expect(workdayDuration(task, CAL)).toBe(1);
    expect(workdayDuration({ ...task, allowNonWorkingDays: true }, CAL)).toBe(3);
  });

  it('a cascata pode colocar a tarefa liberada no sábado e no feriado', () => {
    const tasks = [
      { ...base, id: 1, startDate: '2026-10-14', dueDate: '2026-10-16' },
      { ...base, id: 2, startDate: '2026-10-15', dueDate: '2026-10-16', allowNonWorkingDays: true },
      { ...base, id: 3, startDate: '2026-10-15', dueDate: '2026-10-15' },
    ];
    const deps = [
      { predecessorId: 1, successorId: 2, type: 'FS' as const, lagDays: 0 },
      { predecessorId: 1, successorId: 3, type: 'FS' as const, lagDays: 0 },
    ];
    const calendar: WorkCalendar = { workingDays: [1, 2, 3, 4, 5], holidays: new Set(['2026-10-19']) };
    expect(cascadeSchedule(tasks, deps, calendar)).toEqual([
      { id: 2, startDate: '2026-10-17', dueDate: '2026-10-18' },
      // A tarefa comum pula o fim de semana e o feriado da segunda 19.
      { id: 3, startDate: '2026-10-20', dueDate: '2026-10-20' },
    ]);
  });

  it('distribui a estimativa por todos os dias e a capacidade desconta feriados', () => {
    const { byUser } = computeAllocations(
      [
        {
          id: 1,
          parentId: null,
          status: 'todo',
          startDate: '2026-10-16',
          dueDate: '2026-10-18',
          estimateSeconds: 6 * 3600,
          estimateMode: 'total',
          assigneeIds: [7],
          allowNonWorkingDays: true,
        },
      ],
      { start: '2026-10-12', end: '2026-10-18' },
      CAL,
    );
    expect(byUser.get(7)!.get('2026-10-17')).toBe(7200);
    expect(capacityInRange(40, { start: '2026-10-12', end: '2026-10-18' }, CAL)).toBe(32 * 3600);
  });

  it('o caminho crítico continua calculado com o feriado no meio', () => {
    const tasks = [
      { ...base, id: 1, startDate: '2026-10-09', dueDate: '2026-10-09' },
      { ...base, id: 2, startDate: '2026-10-13', dueDate: '2026-10-13' },
    ];
    const result = computeCriticalPath(tasks, [{ predecessorId: 1, successorId: 2, type: 'FS', lagDays: 0 }], CAL);
    expect([...result.criticalTaskIds].sort()).toEqual([1, 2]);
  });
});
