import type { Task } from '@ott/shared';
import { describe, expect, it } from 'vitest';
import { applyFilters, dateBucket, groupTasks, sortTasks } from './taskGrouping';

const TODAY = '2026-10-14'; // quarta-feira

function task(id: number, extra: Partial<Task> = {}): Task {
  return {
    id,
    workspaceId: 1,
    projectId: null,
    parentId: null,
    name: `Tarefa ${id}`,
    description: '',
    notes: '',
    status: 'todo',
    priority: 0,
    startDate: null,
    dueDate: null,
    estimateSeconds: null,
    estimateMode: 'total',
    progress: 0,
    isMilestone: false,
    allowNonWorkingDays: false,
    billable: false,
    position: id,
    assigneeIds: [],
    tagIds: [],
    trackedSeconds: 0,
    createdBy: 1,
    createdAt: `2026-10-0${id}T00:00:00.000Z`,
    updatedAt: '2026-10-01T00:00:00.000Z',
    completedAt: null,
    ...extra,
  };
}

describe('faixas de data', () => {
  it.each([
    ['2026-10-13', 'overdue'],
    ['2026-10-14', 'today'],
    ['2026-10-15', 'tomorrow'],
    ['2026-10-18', 'thisWeek'],
    ['2026-10-25', 'nextWeek'],
    ['2026-10-26', 'later'],
  ])('%s vira %s', (dueDate, bucket) => {
    expect(dateBucket(task(1, { dueDate }), TODAY, 1)).toBe(bucket);
  });

  it('sem data e concluída atrasada não aparecem como atrasadas', () => {
    expect(dateBucket(task(1), TODAY, 1)).toBe('noDate');
    expect(dateBucket(task(1, { dueDate: '2026-10-01', status: 'done' }), TODAY, 1)).toBe('later');
  });
});

describe('ordenação e agrupamento', () => {
  it('ordena por prioridade e mantém sem data no fim', () => {
    const tasks = [task(1, { priority: 1 }), task(2, { priority: 4 }), task(3, { priority: 2 })];
    expect(sortTasks(tasks, 'priority', true).map((t) => t.id)).toEqual([2, 3, 1]);
    const dated = [task(1), task(2, { dueDate: '2026-10-20' }), task(3, { dueDate: '2026-10-15' })];
    expect(sortTasks(dated, 'dueDate', false).map((t) => t.id)).toEqual([3, 2, 1]);
  });

  it('agrupa por data na ordem do Toggl e por responsável repetindo a tarefa', () => {
    const tasks = [task(1), task(2, { dueDate: '2026-10-10' }), task(3, { dueDate: TODAY, assigneeIds: [5, 6] })];
    expect(groupTasks(tasks, 'date', TODAY, 1).map((g) => g.key)).toEqual(['overdue', 'today', 'noDate']);
    const byAssignee = groupTasks(tasks, 'assignee', TODAY, 1);
    expect(byAssignee.map((g) => g.key)).toEqual(['5', '6', '0']);
  });

  it('filtra por responsável, status, busca e oculta concluídas', () => {
    const tasks = [task(1, { assigneeIds: [5] }), task(2, { status: 'done', assigneeIds: [5] }), task(3, { name: 'Layout' })];
    const base = { statuses: [], projectIds: [], priorities: [] };
    expect(applyFilters(tasks, base, { assigneeId: 5, showCompleted: false, search: '' }).map((t) => t.id)).toEqual([1]);
    expect(applyFilters(tasks, base, { assigneeId: null, showCompleted: true, search: 'lay' }).map((t) => t.id)).toEqual([3]);
  });
});
