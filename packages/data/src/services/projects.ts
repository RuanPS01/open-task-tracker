// Projetos. Contagem de tarefas e equipe saem das tarefas do workspace; horas
// registradas ficam somadas no próprio projeto (ver timeEntries.ts).
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type Id,
  type Project,
  type UpdateProjectInput,
} from '@ott/shared';
import { badRequest, notFound, parse } from '../errors';
import {
  paths,
  type ClientDoc,
  type DependencyDoc,
  type ProjectDoc,
  type TaskDoc,
  type TimeEntryDoc,
  type UserDoc,
} from '../store/schema';
import { arrayRemove, arrayUnion, Batch, where } from '../store/types';
import { byName, loadAdminWorkspace, loadWorkspace, nowIso, type Ctx } from './context';

function toProject(doc: ProjectDoc, tasks: readonly TaskDoc[], pinned: ReadonlySet<Id>): Project {
  const { trackerIds, updatedAt: _updatedAt, ...fields } = doc;
  const own = tasks.filter((task) => task.projectId === doc.id);
  const members = new Set(trackerIds);
  for (const task of own) for (const id of task.assigneeIds) members.add(id);
  return {
    ...fields,
    pinned: pinned.has(doc.id),
    taskCount: own.length,
    doneTaskCount: own.filter((task) => task.status === 'done').length,
    memberIds: [...members],
  };
}

async function pinnedOf(ctx: Ctx, uid: Id): Promise<Set<Id>> {
  const user = await ctx.store.get<UserDoc>(paths.users, uid);
  return new Set(user?.pinnedProjectIds ?? []);
}

export async function listProjects(ctx: Ctx, workspaceId: Id): Promise<Project[]> {
  const { uid } = await loadWorkspace(ctx, workspaceId);
  const [projects, tasks, pinned] = await Promise.all([
    ctx.store.list<ProjectDoc>(paths.projects(workspaceId)),
    ctx.store.list<TaskDoc>(paths.tasks(workspaceId)),
    pinnedOf(ctx, uid),
  ]);
  return projects.map((project) => toProject(project, tasks, pinned)).sort(byName);
}

async function getProject(ctx: Ctx, workspaceId: Id, uid: Id, id: Id): Promise<Project> {
  const project = await ctx.store.get<ProjectDoc>(paths.projects(workspaceId), id);
  if (!project) throw notFound('Projeto');
  const tasks = await ctx.store.list<TaskDoc>(paths.tasks(workspaceId), [where('projectId', '==', id)]);
  return toProject(project, tasks, await pinnedOf(ctx, uid));
}

async function checkClient(ctx: Ctx, workspaceId: Id, clientId: Id | null | undefined): Promise<void> {
  if (clientId != null && !(await ctx.store.get<ClientDoc>(paths.clients(workspaceId), clientId))) {
    throw notFound('Cliente');
  }
}

const checkDates = (start: string | null | undefined, end: string | null | undefined) => {
  if (start && end && start > end) throw badRequest('INVALID_DATES', 'O início é posterior ao fim');
};

export async function createProject(ctx: Ctx, workspaceId: Id, raw: CreateProjectInput): Promise<Project> {
  const { uid } = await loadWorkspace(ctx, workspaceId);
  const input = parse(createProjectSchema, raw);
  await checkClient(ctx, workspaceId, input.clientId);
  checkDates(input.startDate, input.endDate);
  const now = nowIso(ctx);
  const project: ProjectDoc = {
    id: ctx.store.newId(),
    workspaceId,
    clientId: input.clientId ?? null,
    name: input.name,
    color: input.color,
    billable: input.billable ?? false,
    estimateSeconds: input.estimateSeconds ?? null,
    hourlyRate: input.hourlyRate ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    archived: false,
    trackedSeconds: 0,
    trackerIds: [],
    createdAt: now,
    updatedAt: now,
  };
  await ctx.store.commit(new Batch().set(paths.projects(workspaceId), project.id, project).ops);
  return toProject(project, [], await pinnedOf(ctx, uid));
}

export async function updateProject(ctx: Ctx, workspaceId: Id, id: Id, raw: UpdateProjectInput): Promise<Project> {
  const { uid } = await loadWorkspace(ctx, workspaceId);
  const input = parse(updateProjectSchema, raw);
  const current = await ctx.store.get<ProjectDoc>(paths.projects(workspaceId), id);
  if (!current) throw notFound('Projeto');
  await checkClient(ctx, workspaceId, input.clientId);
  checkDates(
    input.startDate === undefined ? current.startDate : input.startDate,
    input.endDate === undefined ? current.endDate : input.endDate,
  );
  const { pinned, ...fields } = input;
  const batch = new Batch();
  const changes = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  if (Object.keys(changes).length > 0) batch.update(paths.projects(workspaceId), id, { ...changes, updatedAt: nowIso(ctx) });
  // Fixar é preferência de cada pessoa: fica no perfil, não no projeto.
  if (pinned !== undefined) {
    batch.update(paths.users, uid, { pinnedProjectIds: pinned ? arrayUnion(id) : arrayRemove(id) });
  }
  await ctx.store.commit(batch.ops);
  return getProject(ctx, workspaceId, uid, id);
}

/** Excluir apaga as tarefas do projeto e as dependências delas; os apontamentos ficam sem projeto. */
export async function removeProject(ctx: Ctx, workspaceId: Id, id: Id): Promise<void> {
  await loadAdminWorkspace(ctx, workspaceId);
  if (!(await ctx.store.get<ProjectDoc>(paths.projects(workspaceId), id))) throw notFound('Projeto');
  const [tasks, dependencies, entries] = await Promise.all([
    ctx.store.list<TaskDoc>(paths.tasks(workspaceId), [where('projectId', '==', id)]),
    ctx.store.list<DependencyDoc>(paths.dependencies(workspaceId)),
    ctx.store.list<TimeEntryDoc>(paths.timeEntries(workspaceId), [where('projectId', '==', id)]),
  ]);
  const removed = new Set(tasks.map((task) => task.id));
  const now = nowIso(ctx);
  const batch = new Batch().delete(paths.projects(workspaceId), id);
  for (const task of tasks) batch.delete(paths.tasks(workspaceId), task.id);
  for (const dep of dependencies) {
    if (removed.has(dep.predecessorId) || removed.has(dep.successorId)) batch.delete(paths.dependencies(workspaceId), dep.id);
  }
  for (const entry of entries) {
    batch.update(paths.timeEntries(workspaceId), entry.id, { projectId: null, taskId: null, updatedAt: now });
  }
  await ctx.store.commit(batch.ops);
}
