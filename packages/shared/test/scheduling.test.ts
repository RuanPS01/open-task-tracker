import { describe, expect, it } from 'vitest';
import {
  cascadeSchedule,
  computeCriticalPath,
  earliestStartFor,
  isAncestor,
  rollupSummaries,
  validateDependency,
  workdayDuration,
  type SchedulableDependency,
  type SchedulableTask,
} from '../src/scheduling';

const WEEK = [1, 2, 3, 4, 5];

function task(
  id: number,
  startDate: string | null,
  dueDate: string | null,
  extra: Partial<SchedulableTask> = {},
): SchedulableTask {
  return { id, parentId: null, startDate, dueDate, isMilestone: false, progress: 0, ...extra };
}

function fs(predecessorId: number, successorId: number, lagDays = 0): SchedulableDependency {
  return { predecessorId, successorId, type: 'FS', lagDays };
}

describe('validação de dependência', () => {
  const tasks = [task(1, null, null), task(2, null, null), task(3, null, null), task(4, null, null, { parentId: 1 })];

  it('recusa ligar a tarefa a ela mesma', () => {
    expect(validateDependency(tasks, [], fs(1, 1))).toBe('self');
  });

  it('recusa ligar mãe e filha', () => {
    expect(validateDependency(tasks, [], fs(1, 4))).toBe('hierarchy');
    expect(validateDependency(tasks, [], fs(4, 1))).toBe('hierarchy');
    expect(isAncestor(tasks, 1, 4)).toBe(true);
  });

  it('recusa ligação repetida em qualquer direção', () => {
    expect(validateDependency(tasks, [fs(1, 2)], fs(1, 2))).toBe('duplicate');
    expect(validateDependency(tasks, [fs(1, 2)], fs(2, 1))).toBe('duplicate');
  });

  it('detecta ciclo indireto', () => {
    expect(validateDependency(tasks, [fs(1, 2), fs(2, 3)], fs(3, 1))).toBe('cycle');
    expect(validateDependency(tasks, [fs(1, 2), fs(2, 3)], fs(1, 3))).toBeNull();
  });

  it('detecta ciclo que passa pela hierarquia', () => {
    // 2 depende da mãe 1; ligar 2 antes da filha 4 obrigaria 1 a terminar depois de si mesma.
    expect(validateDependency(tasks, [fs(1, 2)], fs(2, 4))).toBe('cycle');
  });
});

describe('restrições de dependência', () => {
  const pred = { startDate: '2026-10-12', dueDate: '2026-10-16' };

  it('FS começa no dia útil seguinte ao fim da predecessora', () => {
    expect(earliestStartFor(fs(1, 2), pred, { isMilestone: false, duration: 2 }, WEEK)).toBe('2026-10-19');
  });

  it('FS com marco cai no mesmo dia do fim', () => {
    expect(earliestStartFor(fs(1, 2), pred, { isMilestone: true, duration: 0 }, WEEK)).toBe('2026-10-16');
  });

  it('FS respeita atraso em dias úteis', () => {
    expect(earliestStartFor(fs(1, 2, 2), pred, { isMilestone: false, duration: 1 }, WEEK)).toBe('2026-10-21');
  });

  it('SS, FF e SF', () => {
    const dep = (type: SchedulableDependency['type']) => ({ ...fs(1, 2), type });
    expect(earliestStartFor(dep('SS'), pred, { isMilestone: false, duration: 3 }, WEEK)).toBe('2026-10-12');
    // FF: precisa terminar junto (16), com 3 dias úteis começa na quarta 14.
    expect(earliestStartFor(dep('FF'), pred, { isMilestone: false, duration: 3 }, WEEK)).toBe('2026-10-14');
    // SF: termina quando a predecessora começa (12); com 2 dias começa na sexta 9.
    expect(earliestStartFor(dep('SF'), pred, { isMilestone: false, duration: 2 }, WEEK)).toBe('2026-10-09');
  });
});

describe('cascata', () => {
  it('empurra a sucessora preservando dias úteis', () => {
    const tasks = [task(1, '2026-10-12', '2026-10-21'), task(2, '2026-10-19', '2026-10-20')];
    expect(cascadeSchedule(tasks, [fs(1, 2)], WEEK)).toEqual([
      { id: 2, startDate: '2026-10-22', dueDate: '2026-10-23' },
    ]);
  });

  it('propaga em cadeia e atravessa fim de semana', () => {
    const tasks = [
      task(1, '2026-10-12', '2026-10-16'),
      task(2, '2026-10-14', '2026-10-15'),
      task(3, '2026-10-16', '2026-10-16'),
    ];
    const changes = cascadeSchedule(tasks, [fs(1, 2), fs(2, 3)], WEEK);
    expect(changes).toEqual([
      { id: 2, startDate: '2026-10-19', dueDate: '2026-10-20' },
      { id: 3, startDate: '2026-10-21', dueDate: '2026-10-21' },
    ]);
  });

  it('nunca puxa a sucessora para trás', () => {
    const tasks = [task(1, '2026-10-12', '2026-10-12'), task(2, '2026-10-26', '2026-10-27')];
    expect(cascadeSchedule(tasks, [fs(1, 2)], WEEK)).toEqual([]);
  });

  it('aplica a dependência de uma mãe sobre as filhas', () => {
    const tasks = [
      task(1, '2026-10-12', '2026-10-16'),
      task(2, null, null),
      task(3, '2026-10-14', '2026-10-14', { parentId: 2 }),
      task(4, '2026-10-15', '2026-10-16', { parentId: 2 }),
    ];
    const changes = cascadeSchedule(tasks, [fs(1, 2)], WEEK);
    expect(changes).toEqual([
      { id: 3, startDate: '2026-10-19', dueDate: '2026-10-19' },
      { id: 4, startDate: '2026-10-19', dueDate: '2026-10-20' },
    ]);
  });

  it('usa as datas recalculadas da mãe como predecessora', () => {
    const tasks = [
      task(1, null, null),
      task(2, '2026-10-12', '2026-10-13', { parentId: 1 }),
      task(3, '2026-10-12', '2026-10-15', { parentId: 1 }),
      task(4, '2026-10-14', '2026-10-14'),
    ];
    expect(cascadeSchedule(tasks, [fs(1, 4)], WEEK)).toEqual([
      { id: 4, startDate: '2026-10-16', dueDate: '2026-10-16' },
    ]);
  });

  it('ignora tarefas sem data e não quebra com ciclo', () => {
    const tasks = [task(1, null, null), task(2, '2026-10-12', '2026-10-12')];
    expect(cascadeSchedule(tasks, [fs(1, 2)], WEEK)).toEqual([]);
    expect(cascadeSchedule([task(1, '2026-10-12', '2026-10-12'), task(2, '2026-10-12', '2026-10-12')], [fs(1, 2), fs(2, 1)], WEEK)).toEqual([]);
  });
});

describe('resumo das tarefas-mãe', () => {
  it('pega o menor início, o maior fim e o progresso ponderado', () => {
    const tasks = [
      task(1, null, null),
      task(2, '2026-10-12', '2026-10-21', { parentId: 1, progress: 100 }),
      task(3, '2026-10-22', '2026-10-22', { parentId: 1, progress: 0 }),
      task(4, null, null, { parentId: 1, progress: 0 }),
    ];
    const summary = rollupSummaries(tasks).get(1)!;
    expect(summary.startDate).toBe('2026-10-12');
    expect(summary.dueDate).toBe('2026-10-22');
    // Pesos: 10 dias, 1 dia e 1 (sem data). 1000 / 12 = 83.
    expect(summary.progress).toBe(83);
  });

  it('funciona em mais de um nível', () => {
    const tasks = [
      task(1, null, null),
      task(2, null, null, { parentId: 1 }),
      task(3, '2026-11-02', '2026-11-03', { parentId: 2 }),
    ];
    expect(rollupSummaries(tasks).get(1)).toEqual({
      startDate: '2026-11-02',
      dueDate: '2026-11-03',
      progress: 0,
    });
  });
});

describe('caminho crítico', () => {
  it('marca a cadeia sem folga e calcula a folga das demais', () => {
    // 1 (seg a qua) leva a 2 (qui a sex) e a 3 (qui); 3 tem 1 dia de folga.
    const tasks = [
      task(1, '2026-10-12', '2026-10-14'),
      task(2, '2026-10-15', '2026-10-16'),
      task(3, '2026-10-15', '2026-10-15'),
    ];
    const result = computeCriticalPath(tasks, [fs(1, 2), fs(1, 3)], WEEK);
    expect([...result.criticalTaskIds].sort()).toEqual([1, 2]);
    expect(result.floatByTask.get(3)).toBe(1);
    expect(result.projectEnd).toBe('2026-10-16');
  });

  it('conta folga em dias úteis atravessando o fim de semana', () => {
    const tasks = [task(1, '2026-10-16', '2026-10-16'), task(2, '2026-10-21', '2026-10-21')];
    const result = computeCriticalPath(tasks, [fs(1, 2)], WEEK);
    // Entre sexta 16 e quarta 21 há segunda e terça livres: 2 dias de folga.
    expect(result.floatByTask.get(1)).toBe(2);
    expect(result.criticalTaskIds.has(2)).toBe(true);
  });

  it('trata marco como duração zero', () => {
    const tasks = [
      task(1, '2026-10-12', '2026-10-16'),
      task(2, '2026-10-16', '2026-10-16', { isMilestone: true }),
    ];
    const result = computeCriticalPath(tasks, [fs(1, 2)], WEEK);
    expect([...result.criticalTaskIds].sort()).toEqual([1, 2]);
    expect(workdayDuration(tasks[1]!, WEEK)).toBe(0);
  });

  it('devolve vazio sem tarefas agendadas', () => {
    const result = computeCriticalPath([task(1, null, null)], [], WEEK);
    expect(result.projectEnd).toBeNull();
    expect(result.criticalTaskIds.size).toBe(0);
  });
});
