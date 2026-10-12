import { describe, expect, it } from 'vitest';
import {
  capacityInRange,
  computeAllocations,
  dailyCapacitySeconds,
  UNASSIGNED,
  type AllocatableTask,
} from '../src/capacity';

const WEEK = [1, 2, 3, 4, 5];
const RANGE = { start: '2026-10-12', end: '2026-10-18' };

function task(id: string, extra: Partial<AllocatableTask>): AllocatableTask {
  return {
    id,
    parentId: null,
    status: 'todo',
    startDate: '2026-10-12',
    dueDate: '2026-10-16',
    estimateSeconds: 10 * 3600,
    estimateMode: 'total',
    assigneeIds: ['7'],
    ...extra,
  };
}

describe('alocação de carga', () => {
  it('divide a estimativa total pelos dias úteis e responsáveis', () => {
    const { byUser } = computeAllocations([task('1', { assigneeIds: ['7', '8'] })], RANGE, WEEK);
    expect(byUser.get('7')!.get('2026-10-12')).toBe(3600);
    expect(byUser.get('8')!.get('2026-10-16')).toBe(3600);
    expect(byUser.get('7')!.has('2026-10-17')).toBe(false);
  });

  it('estimativa por dia vale inteira para cada responsável', () => {
    const { byUser } = computeAllocations(
      [task('1', { estimateMode: 'per_day', estimateSeconds: 2 * 3600, assigneeIds: ['7', '8'] })],
      RANGE,
      WEEK,
    );
    expect(byUser.get('8')!.get('2026-10-14')).toBe(7200);
  });

  it('corta pelo intervalo pedido sem mudar a taxa diária', () => {
    const { byUser, byTask } = computeAllocations(
      [task('1', { startDate: '2026-10-05', dueDate: '2026-10-16' })],
      RANGE,
      WEEK,
    );
    expect(byUser.get('7')!.get('2026-10-12')).toBe(3600);
    expect(byTask.get('1')!.get('7')).toBe(5 * 3600);
  });

  it('ignora concluídas, sem data, sem estimativa e tarefas-mãe', () => {
    const { byUser } = computeAllocations(
      [
        task('1', { status: 'done' }),
        task('2', { startDate: null }),
        task('3', { estimateSeconds: null }),
        task('4', {}),
        task('5', { parentId: '4', estimateSeconds: 5 * 3600 }),
      ],
      RANGE,
      WEEK,
    );
    expect(byUser.get('7')!.get('2026-10-12')).toBe(3600);
  });

  it('agrupa tarefas sem responsável', () => {
    const { byUser } = computeAllocations([task('1', { assigneeIds: [] })], RANGE, WEEK);
    expect(byUser.get(UNASSIGNED)!.get('2026-10-13')).toBe(7200);
  });
});

describe('capacidade', () => {
  it('converte horas semanais em capacidade diária e por intervalo', () => {
    expect(dailyCapacitySeconds(40, WEEK)).toBe(8 * 3600);
    expect(capacityInRange(40, RANGE, WEEK)).toBe(40 * 3600);
    expect(dailyCapacitySeconds(40, [])).toBe(0);
  });
});
