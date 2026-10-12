// Agrupamento e ordenação da tela de Tarefas (funções puras, testadas).
import { addDays, startOfWeekIso, type Id, type IsoDate, type Task } from '@ott/shared';

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
  return [...tasks].sort((a, b) => compare[sortBy](a, b) * direction || a.id - b.id);
}

export interface TaskGroup {
  key: string;
  tasks: Task[];
}

export function groupTasks(tasks: Task[], groupBy: GroupBy, today: IsoDate, weekStart: number): TaskGroup[] {
  if (groupBy === 'none') return [{ key: 'all', tasks }];
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
        push(String(task.projectId ?? 0), task);
        break;
      case 'status':
        push(task.status, task);
        break;
      case 'priority':
        push(String(task.priority), task);
        break;
      case 'assignee':
        if (task.assigneeIds.length === 0) push('0', task);
        for (const id of task.assigneeIds) push(String(id), task);
        break;
    }
  }
  const order: Record<GroupBy, string[] | null> = {
    date: DATE_BUCKETS,
    status: ['todo', 'in_progress', 'done'],
    priority: ['4', '3', '2', '1', '0'],
    project: null,
    assignee: null,
    none: null,
  };
  const keys = order[groupBy] ?? [...groups.keys()].sort((a, b) => (a === '0' ? 1 : b === '0' ? -1 : 0));
  return keys.filter((key) => groups.has(key)).map((key) => ({ key, tasks: groups.get(key)! }));
}

export interface TaskFilters {
  statuses: string[];
  projectIds: Id[];
  priorities: number[];
}

export function applyFilters(
  tasks: Task[],
  filters: TaskFilters,
  options: { assigneeId: Id | null; showCompleted: boolean; search: string },
): Task[] {
  const search = options.search.trim().toLowerCase();
  return tasks.filter((task) => {
    if (!options.showCompleted && task.status === 'done') return false;
    if (options.assigneeId !== null && !task.assigneeIds.includes(options.assigneeId)) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) return false;
    if (filters.projectIds.length > 0 && !filters.projectIds.includes(task.projectId ?? 0)) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false;
    if (search && !task.name.toLowerCase().includes(search) && !task.description.toLowerCase().includes(search)) return false;
    return true;
  });
}
