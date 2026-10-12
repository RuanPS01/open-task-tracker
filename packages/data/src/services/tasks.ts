// Regras de negócio de tarefas e dependências. O cálculo (cascata, datas e progresso
// das tarefas-mãe) vem de @ott/shared e roda sobre uma cópia em memória de todas as
// tarefas do workspace; no fim, só os documentos que mudaram são gravados, num lote.
import {
  cascadeSchedule,
  createDependencySchema,
  createTaskSchema,
  descendantIds,
  rollupSummaries,
  scheduleTasksSchema,
  updateDependencySchema,
  updateTaskSchema,
  validateDependency,
  type CreateDependencyInput,
  type CreateTaskInput,
  type Id,
  type SchedulableDependency,
  type SchedulableTask,
  type ScheduleTasksInput,
  type Task,
  type TaskDependency,
  type TaskStatus,
  type UpdateDependencyInput,
  type UpdateTaskInput,
  type WorkCalendar,
} from '@ott/shared';
import { badRequest, conflict, notFound, parse } from '../errors';
import {
  paths,
  type DependencyDoc,
  type HolidayDoc,
  type MemberDoc,
  type ProjectDoc,
  type TagDoc,
  type TaskDoc,
  type TimeEntryDoc,
  type WorkspaceDoc,
} from '../store/schema';
import { Batch, where } from '../store/types';
import { loadWorkspace, nowIso, type Ctx, type WorkspaceAccess } from './context';

export const toSchedulable = (task: TaskDoc): SchedulableTask => ({
  id: task.id,
  parentId: task.parentId,
  startDate: task.startDate,
  dueDate: task.dueDate,
  isMilestone: task.isMilestone,
  allowNonWorkingDays: task.allowNonWorkingDays,
  progress: task.progress,
});

const byPosition = (a: TaskDoc, b: TaskDoc) => a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const unique = <T>(values: readonly T[]) => [...new Set(values)];

export async function listTaskDocs(ctx: Ctx, workspaceId: Id): Promise<TaskDoc[]> {
  return (await ctx.store.list<TaskDoc>(paths.tasks(workspaceId))).sort(byPosition);
}

export async function listDependencyDocs(ctx: Ctx, workspaceId: Id): Promise<DependencyDoc[]> {
  const deps = await ctx.store.list<DependencyDoc>(paths.dependencies(workspaceId));
  return deps.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** Calendário do workspace: dias úteis da semana e feriados cadastrados. */
export async function loadCalendar(ctx: Ctx, workspace: WorkspaceDoc): Promise<WorkCalendar> {
  const holidays = await ctx.store.list<HolidayDoc>(paths.holidays(workspace.id));
  return { workingDays: workspace.workingDays, holidays: new Set(holidays.map((holiday) => holiday.date)) };
}

/**
 * Aplica a cascata de dependências (se o workspace usa agendamento automático) e
 * recalcula datas, progresso e status das tarefas-mãe, alterando `working`.
 */
export function applyScheduling(
  working: Map<Id, TaskDoc>,
  dependencies: readonly SchedulableDependency[],
  calendar: WorkCalendar,
  autoSchedule: boolean,
  now: string,
): void {
  let tasks = [...working.values()].map(toSchedulable);
  if (autoSchedule) {
    const moves = cascadeSchedule(tasks, dependencies, calendar);
    for (const move of moves) {
      const task = working.get(move.id);
      if (!task) continue;
      task.startDate = move.startDate;
      task.dueDate = move.dueDate;
    }
    if (moves.length > 0) tasks = [...working.values()].map(toSchedulable);
  }

  const childStatuses = new Map<Id, TaskStatus[]>();
  for (const task of working.values()) {
    if (task.parentId === null) continue;
    const list = childStatuses.get(task.parentId) ?? [];
    list.push(task.status);
    childStatuses.set(task.parentId, list);
  }
  for (const [id, summary] of rollupSummaries(tasks)) {
    const task = working.get(id);
    if (!task) continue;
    // Status da mãe também sai das filhas: todas concluídas, concluída; alguma
    // começada, em andamento; nenhuma, a fazer.
    const statuses = childStatuses.get(id) ?? [];
    const derived: TaskStatus = statuses.every((status) => status === 'done')
      ? 'done'
      : statuses.some((status) => status !== 'todo')
        ? 'in_progress'
        : 'todo';
    if (statuses.length > 0 && derived !== task.status) {
      task.status = derived;
      task.completedAt = derived === 'done' ? now : null;
    }
    if (summary.startDate && summary.dueDate) {
      task.startDate = summary.startDate;
      task.dueDate = summary.dueDate;
    }
    task.progress = summary.progress;
  }
}

const sameValue = (a: unknown, b: unknown) =>
  Array.isArray(a) || Array.isArray(b) ? JSON.stringify(a) === JSON.stringify(b) : a === b;

/** Grava no lote as tarefas novas e os campos que mudaram. Devolve as tarefas alteradas. */
export function writeChanges(
  batch: Batch,
  workspaceId: Id,
  original: ReadonlyMap<Id, TaskDoc>,
  working: ReadonlyMap<Id, TaskDoc>,
  now: string,
): TaskDoc[] {
  const changed: TaskDoc[] = [];
  for (const task of working.values()) {
    const before = original.get(task.id);
    if (!before) {
      batch.set(paths.tasks(workspaceId), task.id, task);
      changed.push(task);
      continue;
    }
    const fields: Record<string, unknown> = {};
    for (const key of Object.keys(task) as (keyof TaskDoc)[]) {
      if (key === 'updatedAt' || key === 'trackedSeconds') continue;
      if (!sameValue(task[key], before[key])) fields[key] = task[key];
    }
    if (Object.keys(fields).length === 0) continue;
    task.updatedAt = now;
    batch.update(paths.tasks(workspaceId), task.id, { ...fields, updatedAt: now });
    changed.push(task);
  }
  return changed;
}

export const cloneTasks = (tasks: readonly TaskDoc[]) => new Map(tasks.map((task) => [task.id, structuredClone(task)]));

interface Snapshot {
  access: WorkspaceAccess;
  tasks: TaskDoc[];
  dependencies: DependencyDoc[];
  calendar: WorkCalendar;
}

async function loadSnapshot(ctx: Ctx, workspaceId: Id): Promise<Snapshot> {
  const access = await loadWorkspace(ctx, workspaceId);
  const [tasks, dependencies, calendar] = await Promise.all([
    listTaskDocs(ctx, workspaceId),
    listDependencyDocs(ctx, workspaceId),
    loadCalendar(ctx, access.doc),
  ]);
  return { access, tasks, dependencies, calendar };
}

/** Recalcula o cronograma inteiro (mudou feriado, dia útil ou agendamento automático). */
export async function rescheduleWorkspace(ctx: Ctx, workspaceId: Id): Promise<void> {
  const { access, tasks, dependencies, calendar } = await loadSnapshot(ctx, workspaceId);
  const original = new Map(tasks.map((task) => [task.id, task]));
  const working = cloneTasks(tasks);
  const now = nowIso(ctx);
  applyScheduling(working, dependencies, calendar, access.doc.autoSchedule, now);
  const batch = new Batch();
  writeChanges(batch, workspaceId, original, working, now);
  await ctx.store.commit(batch.ops);
}

export function normalizeDates(
  startDate: string | null,
  dueDate: string | null,
  isMilestone: boolean,
): { startDate: string | null; dueDate: string | null } {
  if (isMilestone) {
    const date = startDate ?? dueDate;
    return { startDate: date, dueDate: date };
  }
  if (startDate && !dueDate) return { startDate, dueDate: startDate };
  if (startDate && dueDate && startDate > dueDate) {
    throw badRequest('INVALID_DATES', 'A data de início é posterior à data de entrega');
  }
  return { startDate, dueDate };
}

async function checkReferences(
  ctx: Ctx,
  workspaceId: Id,
  input: { projectId?: Id | null; assigneeIds?: Id[]; tagIds?: Id[] },
): Promise<void> {
  if (input.projectId != null && !(await ctx.store.get<ProjectDoc>(paths.projects(workspaceId), input.projectId))) {
    throw notFound('Projeto');
  }
  if (input.assigneeIds && input.assigneeIds.length > 0) {
    const members = new Set((await ctx.store.list<MemberDoc>(paths.members(workspaceId))).map((m) => m.userId));
    if (input.assigneeIds.some((id) => !members.has(id))) {
      throw badRequest('INVALID_ASSIGNEE', 'Responsável não é membro do workspace');
    }
  }
  if (input.tagIds && input.tagIds.length > 0) {
    const tags = new Set((await ctx.store.list<TagDoc>(paths.tags(workspaceId))).map((tag) => tag.id));
    if (input.tagIds.some((id) => !tags.has(id))) throw notFound('Tag');
  }
}

export function nextPosition(tasks: Iterable<TaskDoc>, parentId: Id | null): number {
  let max = 0;
  for (const task of tasks) if (task.parentId === parentId && task.position > max) max = task.position;
  return max + 1;
}

// --- Tarefas -----------------------------------------------------------------

export async function listTasks(ctx: Ctx, workspaceId: Id): Promise<Task[]> {
  await loadWorkspace(ctx, workspaceId);
  return listTaskDocs(ctx, workspaceId);
}

export async function createTask(ctx: Ctx, workspaceId: Id, raw: CreateTaskInput): Promise<Task> {
  const input = parse(createTaskSchema, raw);
  const { access, tasks, dependencies, calendar } = await loadSnapshot(ctx, workspaceId);
  await checkReferences(ctx, workspaceId, input);
  const original = new Map(tasks.map((task) => [task.id, task]));
  let projectId = input.projectId ?? null;
  const parentId = input.parentId ?? null;
  if (parentId !== null) {
    const parent = original.get(parentId);
    if (!parent) throw notFound('Tarefa-mãe');
    projectId = parent.projectId;
  }
  const isMilestone = input.isMilestone ?? false;
  const dates = normalizeDates(input.startDate ?? null, input.dueDate ?? null, isMilestone);
  const status = input.status ?? 'todo';
  const now = nowIso(ctx);
  const task: TaskDoc = {
    id: ctx.store.newId(),
    workspaceId,
    projectId,
    parentId,
    name: input.name,
    description: input.description ?? '',
    notes: input.notes ?? '',
    status,
    priority: input.priority ?? 0,
    ...dates,
    estimateSeconds: input.estimateSeconds ?? null,
    estimateMode: input.estimateMode ?? 'total',
    progress: status === 'done' ? 100 : (input.progress ?? 0),
    isMilestone,
    allowNonWorkingDays: input.allowNonWorkingDays ?? false,
    billable: input.billable ?? false,
    position: input.position ?? nextPosition(tasks, parentId),
    assigneeIds: unique(input.assigneeIds ?? []),
    tagIds: unique(input.tagIds ?? []),
    trackedSeconds: 0,
    createdBy: access.uid,
    createdAt: now,
    updatedAt: now,
    completedAt: status === 'done' ? now : null,
  };
  const working = cloneTasks(tasks);
  working.set(task.id, task);
  if (dates.startDate || parentId !== null) {
    applyScheduling(working, dependencies, calendar, access.doc.autoSchedule, now);
  }
  const batch = new Batch();
  writeChanges(batch, workspaceId, original, working, now);
  await ctx.store.commit(batch.ops);
  return working.get(task.id)!;
}

const COPIED_FIELDS = [
  'name',
  'description',
  'notes',
  'priority',
  'estimateSeconds',
  'estimateMode',
  'progress',
  'billable',
  'position',
  'allowNonWorkingDays',
] as const;

export async function updateTask(ctx: Ctx, workspaceId: Id, id: Id, raw: UpdateTaskInput): Promise<Task> {
  const input = parse(updateTaskSchema, raw);
  const { access, tasks, dependencies, calendar } = await loadSnapshot(ctx, workspaceId);
  const original = new Map(tasks.map((task) => [task.id, task]));
  const current = original.get(id);
  if (!current) throw notFound('Tarefa');
  await checkReferences(ctx, workspaceId, input);

  const working = cloneTasks(tasks);
  const task = working.get(id)!;
  let projectId = input.projectId === undefined ? current.projectId : input.projectId;
  let touchesSchedule = false;

  if (input.parentId !== undefined && input.parentId !== current.parentId) {
    const parentId = input.parentId;
    if (parentId !== null) {
      if (parentId === id) throw badRequest('INVALID_PARENT', 'Uma tarefa não pode ser mãe de si mesma');
      const parent = original.get(parentId);
      if (!parent) throw notFound('Tarefa-mãe');
      if (descendantIds(tasks.map(toSchedulable), id).includes(parentId)) {
        throw badRequest('INVALID_PARENT', 'A nova mãe é uma subtarefa desta tarefa');
      }
      projectId = parent.projectId;
    }
    task.parentId = parentId;
    task.position = nextPosition(working.values(), parentId);
    touchesSchedule = true;
  }

  for (const key of COPIED_FIELDS) {
    if (input[key] !== undefined) (task as unknown as Record<string, unknown>)[key] = input[key];
  }
  if (input.progress !== undefined || input.allowNonWorkingDays !== undefined) touchesSchedule = true;

  const isMilestone = input.isMilestone ?? current.isMilestone;
  if (input.isMilestone !== undefined) {
    task.isMilestone = input.isMilestone;
    touchesSchedule = true;
  }
  if (input.startDate !== undefined || input.dueDate !== undefined || input.isMilestone !== undefined) {
    const dates = normalizeDates(
      input.startDate === undefined ? current.startDate : input.startDate,
      input.dueDate === undefined ? current.dueDate : input.dueDate,
      isMilestone,
    );
    task.startDate = dates.startDate;
    task.dueDate = dates.dueDate;
    touchesSchedule = true;
  }

  const now = nowIso(ctx);
  if (input.status !== undefined && input.status !== current.status) {
    task.status = input.status;
    touchesSchedule = true;
    if (input.status === 'done') {
      task.completedAt = now;
      task.progress = 100;
    } else {
      task.completedAt = null;
      // Reabrir uma tarefa concluída não pode deixar a barra do Gantt cheia.
      if (current.status === 'done' && input.progress === undefined) task.progress = 0;
    }
  }

  if (projectId !== current.projectId) {
    // Subtarefas herdam o projeto da mãe: mover a mãe de projeto leva a árvore junto.
    task.projectId = projectId;
    for (const childId of descendantIds([...working.values()].map(toSchedulable), id)) {
      working.get(childId)!.projectId = projectId;
    }
  }
  if (input.assigneeIds) task.assigneeIds = unique(input.assigneeIds);
  if (input.tagIds) task.tagIds = unique(input.tagIds);

  if (touchesSchedule) applyScheduling(working, dependencies, calendar, access.doc.autoSchedule, now);
  const batch = new Batch();
  writeChanges(batch, workspaceId, original, working, now);
  await ctx.store.commit(batch.ops);
  return working.get(id)!;
}

/** Lote de datas vindo do Gantt (arrastar barra). Devolve todas as tarefas alteradas. */
export async function scheduleTasks(ctx: Ctx, workspaceId: Id, raw: ScheduleTasksInput): Promise<{ tasks: Task[] }> {
  const input = parse(scheduleTasksSchema, raw);
  const { access, tasks, dependencies, calendar } = await loadSnapshot(ctx, workspaceId);
  const original = new Map(tasks.map((task) => [task.id, task]));
  const working = cloneTasks(tasks);
  for (const update of input.updates) {
    const task = working.get(update.id);
    if (!task) throw notFound('Tarefa');
    Object.assign(task, normalizeDates(update.startDate, update.dueDate, task.isMilestone));
  }
  const now = nowIso(ctx);
  applyScheduling(working, dependencies, calendar, access.doc.autoSchedule, now);
  const batch = new Batch();
  const changed = writeChanges(batch, workspaceId, original, working, now);
  await ctx.store.commit(batch.ops);
  return { tasks: changed };
}

/** Exclui a tarefa e as subtarefas, as dependências delas e solta os apontamentos ligados. */
export async function removeTask(ctx: Ctx, workspaceId: Id, id: Id): Promise<void> {
  const { access, tasks, dependencies, calendar } = await loadSnapshot(ctx, workspaceId);
  const original = new Map(tasks.map((task) => [task.id, task]));
  if (!original.has(id)) throw notFound('Tarefa');
  const removed = new Set([id, ...descendantIds(tasks.map(toSchedulable), id)]);
  const now = nowIso(ctx);
  const batch = new Batch();
  const working = cloneTasks(tasks);
  for (const taskId of removed) {
    working.delete(taskId);
    original.delete(taskId);
    batch.delete(paths.tasks(workspaceId), taskId);
  }
  const remaining = dependencies.filter((dep) => {
    const touches = removed.has(dep.predecessorId) || removed.has(dep.successorId);
    if (touches) batch.delete(paths.dependencies(workspaceId), dep.id);
    return !touches;
  });
  const linked = await Promise.all(
    [...removed].map((taskId) =>
      ctx.store.list<TimeEntryDoc>(paths.timeEntries(workspaceId), [where('taskId', '==', taskId)]),
    ),
  );
  for (const entry of linked.flat()) batch.update(paths.timeEntries(workspaceId), entry.id, { taskId: null, updatedAt: now });
  applyScheduling(working, remaining, calendar, access.doc.autoSchedule, now);
  writeChanges(batch, workspaceId, original, working, now);
  await ctx.store.commit(batch.ops);
}

// --- Dependências ------------------------------------------------------------

const REJECTION_MESSAGES = {
  self: 'Uma tarefa não pode depender de si mesma',
  hierarchy: 'Tarefa-mãe e subtarefa não podem ser ligadas por dependência',
  duplicate: 'Estas tarefas já estão ligadas',
  cycle: 'A dependência criaria um ciclo',
} as const;

const toDependency = ({ createdAt: _createdAt, ...dep }: DependencyDoc): TaskDependency => dep;

export async function listDependencies(ctx: Ctx, workspaceId: Id): Promise<TaskDependency[]> {
  await loadWorkspace(ctx, workspaceId);
  return (await listDependencyDocs(ctx, workspaceId)).map(toDependency);
}

async function saveWithScheduling(
  ctx: Ctx,
  snapshot: Snapshot,
  dependencies: DependencyDoc[],
  batch: Batch,
): Promise<void> {
  const original = new Map(snapshot.tasks.map((task) => [task.id, task]));
  const working = cloneTasks(snapshot.tasks);
  const now = nowIso(ctx);
  applyScheduling(working, dependencies, snapshot.calendar, snapshot.access.doc.autoSchedule, now);
  writeChanges(batch, snapshot.access.doc.id, original, working, now);
  await ctx.store.commit(batch.ops);
}

export async function createDependency(ctx: Ctx, workspaceId: Id, raw: CreateDependencyInput): Promise<TaskDependency> {
  const input = parse(createDependencySchema, raw);
  const snapshot = await loadSnapshot(ctx, workspaceId);
  const ids = new Set(snapshot.tasks.map((task) => task.id));
  if (!ids.has(input.predecessorId) || !ids.has(input.successorId)) throw notFound('Tarefa');
  const candidate = {
    predecessorId: input.predecessorId,
    successorId: input.successorId,
    type: input.type,
    lagDays: input.lagDays,
  };
  const rejection = validateDependency(snapshot.tasks.map(toSchedulable), snapshot.dependencies, candidate);
  if (rejection) {
    throw conflict(`DEPENDENCY_${rejection.toUpperCase()}`, REJECTION_MESSAGES[rejection]);
  }
  const dep: DependencyDoc = { id: ctx.store.newId(), workspaceId, ...candidate, createdAt: nowIso(ctx) };
  const batch = new Batch().set(paths.dependencies(workspaceId), dep.id, dep);
  await saveWithScheduling(ctx, snapshot, [...snapshot.dependencies, dep], batch);
  return toDependency(dep);
}

export async function updateDependency(ctx: Ctx, workspaceId: Id, id: Id, raw: UpdateDependencyInput): Promise<TaskDependency> {
  const input = parse(updateDependencySchema, raw);
  const snapshot = await loadSnapshot(ctx, workspaceId);
  const current = snapshot.dependencies.find((dep) => dep.id === id);
  if (!current) throw notFound('Dependência');
  const next: DependencyDoc = {
    ...current,
    ...(input.type === undefined ? {} : { type: input.type }),
    ...(input.lagDays === undefined ? {} : { lagDays: input.lagDays }),
  };
  const batch = new Batch().update(paths.dependencies(workspaceId), id, { type: next.type, lagDays: next.lagDays });
  const dependencies = snapshot.dependencies.map((dep) => (dep.id === id ? next : dep));
  await saveWithScheduling(ctx, snapshot, dependencies, batch);
  return toDependency(next);
}

export async function removeDependency(ctx: Ctx, workspaceId: Id, id: Id): Promise<void> {
  await loadWorkspace(ctx, workspaceId);
  if (!(await ctx.store.get<DependencyDoc>(paths.dependencies(workspaceId), id))) throw notFound('Dependência');
  await ctx.store.commit(new Batch().delete(paths.dependencies(workspaceId), id).ops);
}
