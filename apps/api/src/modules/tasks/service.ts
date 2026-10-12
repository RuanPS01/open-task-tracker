// Regras de negócio de tarefas e dependências. As rotas só validam o formato da
// entrada; tudo que depende do estado do banco (hierarquia, membros, cascata) fica aqui.
import {
  cascadeSchedule,
  descendantIds,
  rollupSummaries,
  validateDependency,
  type CreateDependencyInput,
  type CreateTaskInput,
  type ScheduleTasksInput,
  type SchedulableTask,
  type Task,
  type TaskDependency,
  type UpdateDependencyInput,
  type UpdateTaskInput,
  type Workspace,
} from '@ott/shared';
import { nowIso, type Db } from '../../db/database';
import { badRequest, conflict, notFound } from '../../http/errors';
import { memberIdsOf } from '../members/repo';
import { projectExists } from '../projects/repo';
import { tagIdsOf } from '../tags/repo';
import {
  deleteDependency,
  getDependency,
  getTask,
  insertDependency,
  insertTask,
  listDependencies,
  listScheduleRows,
  nextPosition,
  setProjectForDescendants,
  setTaskAssignees,
  setTaskTags,
  updateDependency,
  updateTaskRecord,
  type ScheduleRow,
  type TaskRecord,
} from './repo';

const toSchedulable = (row: ScheduleRow): SchedulableTask => ({
  id: row.id,
  parentId: row.parent_id,
  startDate: row.start_date,
  dueDate: row.due_date,
  isMilestone: row.is_milestone === 1,
  progress: row.progress,
});

/**
 * Aplica a cascata de dependências (se o workspace usa agendamento automático) e
 * recalcula datas e progresso das tarefas-mãe. Devolve os ids que mudaram.
 */
export function applyScheduling(db: Db, workspace: Workspace): number[] {
  const changed = new Set<number>();
  let tasks = listScheduleRows(db, workspace.id).map(toSchedulable);

  if (workspace.autoSchedule) {
    const dependencies = listDependencies(db, workspace.id);
    const moves = cascadeSchedule(tasks, dependencies, workspace.workingDays);
    for (const move of moves) {
      updateTaskRecord(db, workspace.id, move.id, { startDate: move.startDate, dueDate: move.dueDate });
      changed.add(move.id);
    }
    if (moves.length > 0) tasks = listScheduleRows(db, workspace.id).map(toSchedulable);
  }

  const byId = new Map(tasks.map((task) => [task.id, task]));
  for (const [id, summary] of rollupSummaries(tasks)) {
    const current = byId.get(id);
    if (!current) continue;
    const changes: Partial<TaskRecord> = {};
    if (summary.startDate && summary.dueDate) {
      if (summary.startDate !== current.startDate) changes.startDate = summary.startDate;
      if (summary.dueDate !== current.dueDate) changes.dueDate = summary.dueDate;
    }
    if (summary.progress !== current.progress) changes.progress = summary.progress;
    if (Object.keys(changes).length > 0) {
      updateTaskRecord(db, workspace.id, id, changes);
      changed.add(id);
    }
  }
  return [...changed];
}

function normalizeDates(
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

function checkReferences(
  db: Db,
  workspaceId: number,
  input: { projectId?: number | null; assigneeIds?: number[]; tagIds?: number[] },
): void {
  if (input.projectId != null && !projectExists(db, workspaceId, input.projectId)) {
    throw notFound('Projeto');
  }
  if (input.assigneeIds && input.assigneeIds.length > 0) {
    const members = memberIdsOf(db, workspaceId);
    if (input.assigneeIds.some((id) => !members.has(id))) {
      throw badRequest('INVALID_ASSIGNEE', 'Responsável não é membro do workspace');
    }
  }
  if (input.tagIds && input.tagIds.length > 0) {
    const tags = tagIdsOf(db, workspaceId);
    if (input.tagIds.some((id) => !tags.has(id))) throw notFound('Tag');
  }
}

export function createTask(db: Db, workspace: Workspace, userId: number, input: CreateTaskInput): Task {
  return db.transaction(() => {
    checkReferences(db, workspace.id, input);
    let projectId = input.projectId ?? null;
    const parentId = input.parentId ?? null;
    if (parentId !== null) {
      const parent = getTask(db, workspace.id, parentId);
      if (!parent) throw notFound('Tarefa-mãe');
      projectId = parent.projectId;
    }
    const isMilestone = input.isMilestone ?? false;
    const dates = normalizeDates(input.startDate ?? null, input.dueDate ?? null, isMilestone);
    const status = input.status ?? 'todo';
    const id = insertTask(db, workspace.id, userId, {
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
      billable: input.billable ?? false,
      position: input.position ?? nextPosition(db, workspace.id, parentId),
      completedAt: status === 'done' ? nowIso() : null,
    });
    if (input.assigneeIds) setTaskAssignees(db, id, input.assigneeIds);
    if (input.tagIds) setTaskTags(db, id, input.tagIds);
    if (dates.startDate || parentId !== null) applyScheduling(db, workspace);
    return getTask(db, workspace.id, id)!;
  });
}

export function updateTask(db: Db, workspace: Workspace, id: number, input: UpdateTaskInput): Task {
  return db.transaction(() => {
    const current = getTask(db, workspace.id, id);
    if (!current) throw notFound('Tarefa');
    checkReferences(db, workspace.id, input);

    const changes: Partial<TaskRecord> = {};
    let projectId = input.projectId === undefined ? current.projectId : input.projectId;
    let parentId = current.parentId;

    if (input.parentId !== undefined && input.parentId !== current.parentId) {
      parentId = input.parentId;
      if (parentId !== null) {
        if (parentId === id) throw badRequest('INVALID_PARENT', 'Uma tarefa não pode ser mãe de si mesma');
        const parent = getTask(db, workspace.id, parentId);
        if (!parent) throw notFound('Tarefa-mãe');
        const tree = listScheduleRows(db, workspace.id).map(toSchedulable);
        if (descendantIds(tree, id).includes(parentId)) {
          throw badRequest('INVALID_PARENT', 'A nova mãe é uma subtarefa desta tarefa');
        }
        projectId = parent.projectId;
      }
      changes.parentId = parentId;
      changes.position = nextPosition(db, workspace.id, parentId);
    }
    if (projectId !== current.projectId) changes.projectId = projectId;

    for (const key of ['name', 'description', 'notes', 'priority', 'estimateSeconds', 'estimateMode', 'progress', 'billable', 'position'] as const) {
      if (input[key] !== undefined) (changes as Record<string, unknown>)[key] = input[key];
    }

    const isMilestone = input.isMilestone ?? current.isMilestone;
    if (input.isMilestone !== undefined) changes.isMilestone = input.isMilestone;
    if (input.startDate !== undefined || input.dueDate !== undefined || input.isMilestone !== undefined) {
      const dates = normalizeDates(
        input.startDate === undefined ? current.startDate : input.startDate,
        input.dueDate === undefined ? current.dueDate : input.dueDate,
        isMilestone,
      );
      changes.startDate = dates.startDate;
      changes.dueDate = dates.dueDate;
    }

    if (input.status !== undefined && input.status !== current.status) {
      changes.status = input.status;
      if (input.status === 'done') {
        changes.completedAt = nowIso();
        changes.progress = 100;
      } else {
        changes.completedAt = null;
        // Reabrir uma tarefa concluída não pode deixar a barra do Gantt cheia.
        if (current.status === 'done' && input.progress === undefined) changes.progress = 0;
      }
    }

    updateTaskRecord(db, workspace.id, id, changes);
    if (changes.projectId !== undefined) setProjectForDescendants(db, workspace.id, id, projectId);
    if (input.assigneeIds) setTaskAssignees(db, id, input.assigneeIds);
    if (input.tagIds) setTaskTags(db, id, input.tagIds);

    const touchesSchedule =
      changes.startDate !== undefined ||
      changes.dueDate !== undefined ||
      changes.parentId !== undefined ||
      changes.progress !== undefined ||
      changes.isMilestone !== undefined;
    if (touchesSchedule) applyScheduling(db, workspace);
    return getTask(db, workspace.id, id)!;
  });
}

/** Atualização em lote vinda do Gantt (arrastar barra). Devolve todos os ids alterados. */
export function scheduleTasks(db: Db, workspace: Workspace, input: ScheduleTasksInput): number[] {
  return db.transaction(() => {
    const changed = new Set<number>();
    for (const update of input.updates) {
      const current = getTask(db, workspace.id, update.id);
      if (!current) throw notFound('Tarefa');
      const dates = normalizeDates(update.startDate, update.dueDate, current.isMilestone);
      updateTaskRecord(db, workspace.id, update.id, dates);
      changed.add(update.id);
    }
    for (const id of applyScheduling(db, workspace)) changed.add(id);
    return [...changed];
  });
}

export function removeTask(db: Db, workspace: Workspace, id: number): void {
  db.transaction(() => {
    if (!getTask(db, workspace.id, id)) throw notFound('Tarefa');
    db.run('DELETE FROM tasks WHERE id = ? AND workspace_id = ?', id, workspace.id);
    applyScheduling(db, workspace);
  });
}

const REJECTION_MESSAGES = {
  self: 'Uma tarefa não pode depender de si mesma',
  hierarchy: 'Tarefa-mãe e subtarefa não podem ser ligadas por dependência',
  duplicate: 'Estas tarefas já estão ligadas',
  cycle: 'A dependência criaria um ciclo',
} as const;

export function createDependency(db: Db, workspace: Workspace, input: CreateDependencyInput): TaskDependency {
  return db.transaction(() => {
    const predecessor = getTask(db, workspace.id, input.predecessorId);
    const successor = getTask(db, workspace.id, input.successorId);
    if (!predecessor || !successor) throw notFound('Tarefa');
    const candidate = {
      predecessorId: input.predecessorId,
      successorId: input.successorId,
      type: input.type ?? 'FS',
      lagDays: input.lagDays ?? 0,
    };
    const tasks = listScheduleRows(db, workspace.id).map(toSchedulable);
    const rejection = validateDependency(tasks, listDependencies(db, workspace.id), candidate);
    if (rejection) {
      throw conflict(`DEPENDENCY_${rejection.toUpperCase()}`, REJECTION_MESSAGES[rejection]);
    }
    const id = insertDependency(db, workspace.id, candidate);
    applyScheduling(db, workspace);
    return getDependency(db, workspace.id, id)!;
  });
}

export function changeDependency(
  db: Db,
  workspace: Workspace,
  id: number,
  input: UpdateDependencyInput,
): TaskDependency {
  return db.transaction(() => {
    if (!getDependency(db, workspace.id, id)) throw notFound('Dependência');
    updateDependency(db, workspace.id, id, input);
    applyScheduling(db, workspace);
    return getDependency(db, workspace.id, id)!;
  });
}

export function removeDependency(db: Db, workspace: Workspace, id: number): void {
  if (!getDependency(db, workspace.id, id)) throw notFound('Dependência');
  deleteDependency(db, workspace.id, id);
}
