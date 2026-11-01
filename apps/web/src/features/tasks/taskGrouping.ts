// Agrupamento e ordenação da tela de Tarefas (funções puras, testadas).
import {
  addDays,
  compareIds,
  compareStatuses,
  NO_ID,
  startOfWeekIso,
  TASK_STATUSES,
  type CustomStatus,
  type Id,
  type IsoDate,
  type Task,
} from '@ott/shared';

export type GroupBy = 'date' | 'project' | 'status' | 'priority' | 'assignee' | 'none';
export type SortBy = 'priority' | 'dueDate' | 'name' | 'created';
export type DateBucket = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek' | 'later' | 'noDate';

export const DATE_BUCKETS: DateBucket[] = ['overdue', 'today', 'tomorrow', 'thisWeek', 'nextWeek', 'later', 'noDate'];

/** Faixa de data da tarefa pela data de entrega (ou início, se não houver entrega). */
export function dateBucket(task: Pick<Task, 'dueDate' | 'startDate' | 'status'>, today: IsoDate, weekStart: number): DateBucket {
  const date = task.dueDate ?? task.startDate;
  if (!date) return 'noDate';
  if (date < today) return task.status === 'done' ? 'later' : 'overdue';
  if (date === today) return 'today';
  if (date === addDays(today, 1)) return 'tomorrow';
  const thisWeekEnd = addDays(startOfWeekIso(today, weekStart), 6);
  if (date <= thisWeekEnd) return 'thisWeek';
  if (date <= addDays(thisWeekEnd, 7)) return 'nextWeek';
  return 'later';
}

export function sortTasks(tasks: Task[], sortBy: SortBy, descending: boolean): Task[] {
  const direction = descending ? -1 : 1;
  const byName = (a: Task, b: Task) => a.name.localeCompare(b.name);
  const compare: Record<SortBy, (a: Task, b: Task) => number> = {
    priority: (a, b) => a.priority - b.priority || byName(b, a),
    // Sem data fica sempre no fim, independente da direção.
    dueDate: (a, b) => {
      const da = a.dueDate ?? a.startDate;
      const db = b.dueDate ?? b.startDate;
      if (!da && !db) return 0;
      if (!da) return descending ? -1 : 1;
      if (!db) return descending ? 1 : -1;
      return da.localeCompare(db);
    },
    name: byName,
    created: (a, b) => a.createdAt.localeCompare(b.createdAt),
  };
  return [...tasks].sort((a, b) => compare[sortBy](a, b) * direction || compareIds(a.id, b.id));
}

/**
 * Chave do status da tarefa para agrupar, filtrar e montar o quadro. Status customizado
 * que não existe mais (excluído em outra aba) conta como o padrão da categoria.
 */
export function effectiveStatusKey(task: Pick<Task, 'status' | 'statusId'>, known: ReadonlySet<Id>): string {
  return task.statusId !== null && known.has(task.statusId) ? task.statusId : task.status;
}

/**
 * Status que viram colunas do quadro e grupos da lista, na ordem do menu: cada padrão
 * seguido dos customizados da categoria. Entram os do workspace, os do projeto aberto
 * (`projectId`) e os de outros projetos que alguma tarefa da lista usa, para a tela de
 * Tarefas não ganhar colunas vazias de cada projeto.
 */
export function statusOrder(statuses: readonly CustomStatus[], tasks: readonly Pick<Task, 'statusId'>[], projectId?: Id | null): string[] {
  const used = new Set(tasks.map((task) => task.statusId));
  const visible = statuses
    .filter((status) => status.projectId === null || (projectId != null && status.projectId === projectId) || used.has(status.id))
    .sort(compareStatuses);
  return TASK_STATUSES.flatMap((category) => [
    category,
    ...visible.filter((status) => status.category === category).map((status) => status.id),
  ]);
}

export interface TaskGroup {
  key: string;
  tasks: Task[];
}

export function groupTasks(
  tasks: Task[],
  groupBy: GroupBy,
  today: IsoDate,
  weekStart: number,
  statuses: readonly CustomStatus[] = [],
): TaskGroup[] {
  if (groupBy === 'none') return [{ key: 'all', tasks }];
  const known = new Set(statuses.map((status) => status.id));
  const groups = new Map<string, Task[]>();
  const push = (key: string, task: Task) => {
    const list = groups.get(key) ?? [];
    list.push(task);
    groups.set(key, list);
  };
  for (const task of tasks) {
    switch (groupBy) {
      case 'date':
        push(dateBucket(task, today, weekStart), task);
        break;
      case 'project':
        push(task.projectId ?? NO_ID, task);
        break;
      case 'status':
        push(effectiveStatusKey(task, known), task);
        break;
      case 'priority':
        push(String(task.priority), task);
        break;
      case 'assignee':
        if (task.assigneeIds.length === 0) push(NO_ID, task);
        for (const id of task.assigneeIds) push(id, task);
        break;
    }
  }
  const order: Record<GroupBy, string[] | null> = {
    date: DATE_BUCKETS,
    status: groupBy === 'status' ? statusOrder(statuses, tasks) : null,
    priority: ['4', '3', '2', '1', '0'],
    project: null,
    assignee: null,
    none: null,
  };
  const keys = order[groupBy] ?? [...groups.keys()].sort((a, b) => (a === NO_ID ? 1 : b === NO_ID ? -1 : 0));
  return keys.filter((key) => groups.has(key)).map((key) => ({ key, tasks: groups.get(key)! }));
}

export interface TaskFilters {
  /** Chaves de status: a categoria (status padrão) ou o id do status customizado. */
  statuses: string[];
  projectIds: Id[];
  priorities: number[];
}

export function applyFilters(
  tasks: Task[],
  filters: TaskFilters,
  options: { assigneeId: Id | null; showCompleted: boolean; search: string; statuses?: readonly CustomStatus[] },
): Task[] {
  const search = options.search.trim().toLowerCase();
  const known = new Set((options.statuses ?? []).map((status) => status.id));
  return tasks.filter((task) => {
    if (!options.showCompleted && task.status === 'done') return false;
    if (options.assigneeId !== null && !task.assigneeIds.includes(options.assigneeId)) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(effectiveStatusKey(task, known))) return false;
    if (filters.projectIds.length > 0 && !filters.projectIds.includes(task.projectId ?? NO_ID)) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false;
    if (search && !task.name.toLowerCase().includes(search) && !task.description.toLowerCase().includes(search)) return false;
    return true;
  });
}
