// Status customizados: criados pela equipe para o workspace inteiro (só administrador) ou
// para um projeto (qualquer membro), com nome, ícone, cor e categoria. A categoria é um
// dos três status padrão e decide as regras da tarefa (concluir, reabrir, tarefa-mãe), que
// continuam em tasks.ts. Os três padrão não são documentos: valem sempre.
import {
  compareStatuses,
  createStatusSchema,
  updateStatusSchema,
  type CreateStatusInput,
  type CustomStatus,
  type Id,
  type UpdateStatusInput,
} from '@ott/shared';
import { conflict, forbidden, notFound, parse } from '../errors';
import { paths, type ProjectDoc, type StatusDoc, type TaskDoc } from '../store/schema';
import { Batch, where } from '../store/types';
import { loadWorkspace, nowIso, type Ctx, type WorkspaceAccess } from './context';
import {
  applyScheduling,
  cloneTasks,
  listDependencyDocs,
  listStatusDocs,
  listTaskDocs,
  loadCalendar,
  setCategory,
  writeChanges,
} from './tasks';

const sameName = (a: string, b: string) => a.trim().localeCompare(b.trim(), undefined, { sensitivity: 'base' }) === 0;

export async function listStatuses(ctx: Ctx, workspaceId: Id): Promise<CustomStatus[]> {
  await loadWorkspace(ctx, workspaceId);
  return (await listStatusDocs(ctx, workspaceId)).sort(compareStatuses);
}

/** Status do workspace é configuração de todos: só administrador cria, altera ou exclui. */
function checkScope(access: WorkspaceAccess, projectId: Id | null): void {
  if (projectId === null && access.workspace.role !== 'admin') {
    throw forbidden('Apenas administradores mexem nos status do workspace');
  }
}

/**
 * Nome único entre os status que aparecem juntos no mesmo menu: os do workspace com os de
 * qualquer projeto, e os de um projeto entre si.
 */
function checkName(statuses: readonly StatusDoc[], name: string, projectId: Id | null, exceptId?: Id): void {
  const clash = statuses.some(
    (status) =>
      status.id !== exceptId &&
      (status.projectId === null || projectId === null || status.projectId === projectId) &&
      sameName(status.name, name),
  );
  if (clash) throw conflict('NAME_TAKEN', 'Já existe um status com esse nome');
}

export async function createStatus(ctx: Ctx, workspaceId: Id, raw: CreateStatusInput): Promise<CustomStatus> {
  const access = await loadWorkspace(ctx, workspaceId);
  const input = parse(createStatusSchema, raw);
  const projectId = input.projectId ?? null;
  checkScope(access, projectId);
  if (projectId !== null && !(await ctx.store.get<ProjectDoc>(paths.projects(workspaceId), projectId))) {
    throw notFound('Projeto');
  }
  const statuses = await listStatusDocs(ctx, workspaceId);
  checkName(statuses, input.name, projectId);
  const status: StatusDoc = {
    id: ctx.store.newId(),
    workspaceId,
    projectId,
    name: input.name,
    category: input.category,
    icon: input.icon,
    color: input.color,
    // Novo status entra no fim da categoria.
    position: Math.max(0, ...statuses.filter((item) => item.category === input.category).map((item) => item.position)) + 1,
    createdAt: nowIso(ctx),
  };
  await ctx.store.commit(new Batch().set(paths.statuses(workspaceId), status.id, status).ops);
  return status;
}

async function loadStatus(ctx: Ctx, workspaceId: Id, id: Id) {
  const access = await loadWorkspace(ctx, workspaceId);
  const statuses = await listStatusDocs(ctx, workspaceId);
  const status = statuses.find((item) => item.id === id);
  if (!status) throw notFound('Status');
  checkScope(access, status.projectId);
  return { access, statuses, status };
}

/**
 * Altera nome, ícone, cor ou categoria. Mudar a categoria leva as tarefas que usam o
 * status junto (concluir ou reabrir, com o resumo das tarefas-mãe), no mesmo lote.
 */
export async function updateStatus(ctx: Ctx, workspaceId: Id, id: Id, raw: UpdateStatusInput): Promise<CustomStatus> {
  const input = parse(updateStatusSchema, raw);
  const { access, statuses, status } = await loadStatus(ctx, workspaceId, id);
  if (input.name !== undefined) checkName(statuses, input.name, status.projectId, id);
  const changes: Partial<StatusDoc> = {};
  if (input.name !== undefined) changes.name = input.name;
  if (input.icon !== undefined) changes.icon = input.icon;
  if (input.color !== undefined) changes.color = input.color;
  const batch = new Batch();
  if (input.category !== undefined && input.category !== status.category) {
    changes.category = input.category;
    changes.position =
      Math.max(0, ...statuses.filter((item) => item.category === input.category).map((item) => item.position)) + 1;
    const [tasks, dependencies, calendar] = await Promise.all([
      listTaskDocs(ctx, workspaceId),
      listDependencyDocs(ctx, workspaceId),
      loadCalendar(ctx, access.doc),
    ]);
    const now = nowIso(ctx);
    const original = new Map(tasks.map((task) => [task.id, task]));
    const working = cloneTasks(tasks);
    for (const task of working.values()) if (task.statusId === id) setCategory(task, input.category, now);
    applyScheduling(working, dependencies, calendar, access.doc.autoSchedule, now);
    writeChanges(batch, workspaceId, original, working, now);
  }
  batch.update(paths.statuses(workspaceId), id, changes);
  await ctx.store.commit(batch.ops);
  return { ...status, ...changes };
}

/** Exclui o status; as tarefas que o usavam voltam ao status padrão da mesma categoria. */
export async function removeStatus(ctx: Ctx, workspaceId: Id, id: Id): Promise<void> {
  await loadStatus(ctx, workspaceId, id);
  const tasks = await ctx.store.list<TaskDoc>(paths.tasks(workspaceId), [where('statusId', '==', id)]);
  const now = nowIso(ctx);
  const batch = new Batch();
  for (const task of tasks) batch.update(paths.tasks(workspaceId), task.id, { statusId: null, updatedAt: now });
  batch.delete(paths.statuses(workspaceId), id);
  await ctx.store.commit(batch.ops);
}
