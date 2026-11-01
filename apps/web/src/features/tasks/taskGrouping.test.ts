import { NO_ID, type CustomStatus, type Task } from '@ott/shared';
import { describe, expect, it } from 'vitest';
import { applyFilters, dateBucket, groupTasks, sortTasks, statusOrder } from './taskGrouping';

const TODAY = '2026-10-14'; // quarta-feira

function task(n: number, extra: Partial<Task> = {}): Task {
  return {
    id: String(n),
    workspaceId: 'w1',
    projectId: null,
    parentId: null,
    name: `Tarefa ${n}`,
    description: '',
    notes: '',
    status: 'todo',
    statusId: null,
    priority: 0,
    startDate: null,
    dueDate: null,
    estimateSeconds: null,
    estimateMode: 'total',
    progress: 0,
    isMilestone: false,
    allowNonWorkingDays: false,
    billable: false,
    position: n,
    assigneeIds: [],
    tagIds: [],
    trackedSeconds: 0,
    createdBy: 'u1',
    createdAt: `2026-10-0${n}T00:00:00.000Z`,
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
    expect(sortTasks(tasks, 'priority', true).map((t) => t.id)).toEqual(['2', '3', '1']);
    const dated = [task(1), task(2, { dueDate: '2026-10-20' }), task(3, { dueDate: '2026-10-15' })];
    expect(sortTasks(dated, 'dueDate', false).map((t) => t.id)).toEqual(['3', '2', '1']);
  });

  it('agrupa por data na ordem do Toggl e por responsável repetindo a tarefa', () => {
    const tasks = [task(1), task(2, { dueDate: '2026-10-10' }), task(3, { dueDate: TODAY, assigneeIds: ['5', '6'] })];
    expect(groupTasks(tasks, 'date', TODAY, 1).map((g) => g.key)).toEqual(['overdue', 'today', 'noDate']);
    const byAssignee = groupTasks(tasks, 'assignee', TODAY, 1);
    expect(byAssignee.map((g) => g.key)).toEqual(['5', '6', NO_ID]);
  });

  it('filtra por responsável, status, busca e oculta concluídas', () => {
    const tasks = [task(1, { assigneeIds: ['5'] }), task(2, { status: 'done', assigneeIds: ['5'] }), task(3, { name: 'Layout' })];
    const base = { statuses: [], projectIds: [], priorities: [] };
    expect(applyFilters(tasks, base, { assigneeId: '5', showCompleted: false, search: '' }).map((t) => t.id)).toEqual(['1']);
    expect(applyFilters(tasks, base, { assigneeId: null, showCompleted: true, search: 'lay' }).map((t) => t.id)).toEqual(['3']);
  });
});

describe('status customizados no quadro, nos grupos e nos filtros', () => {
  const custom = (id: string, category: CustomStatus['category'], projectId: string | null): CustomStatus => ({
    id,
    workspaceId: 'w1',
    projectId,
    name: id,
    category,
    icon: 'eye',
    color: '#9e5bd9',
    position: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
  });
  const statuses = [custom('revisao', 'in_progress', null), custom('cliente', 'todo', 'p1'), custom('outro', 'todo', 'p2')];

  it('colunas: padrões, os do workspace, os do projeto aberto e os de outros projetos em uso', () => {
    expect(statusOrder(statuses, [], 'p1')).toEqual(['todo', 'cliente', 'in_progress', 'revisao', 'done']);
    expect(statusOrder(statuses, [])).toEqual(['todo', 'in_progress', 'revisao', 'done']);
    expect(statusOrder(statuses, [task(1, { statusId: 'outro' })])).toEqual(['todo', 'outro', 'in_progress', 'revisao', 'done']);
  });

  it('agrupa e filtra pelo status customizado; status que sumiu conta como o padrão', () => {
    const tasks = [
      task(1, { status: 'in_progress', statusId: 'revisao' }),
      task(2, { status: 'in_progress' }),
      task(3, { status: 'in_progress', statusId: 'excluido' }),
    ];
    expect(groupTasks(tasks, 'status', TODAY, 1, statuses).map((g) => [g.key, g.tasks.map((t) => t.id)])).toEqual([
      ['in_progress', ['2', '3']],
      ['revisao', ['1']],
    ]);
    const filters = { statuses: ['revisao'], projectIds: [], priorities: [] };
    expect(applyFilters(tasks, filters, { assigneeId: null, showCompleted: true, search: '', statuses }).map((t) => t.id)).toEqual(['1']);
  });
});
