// Regras do cronômetro e dos apontamentos, espelhando o Toggl Track:
// - um único cronômetro rodando por pessoa (iniciar outro para o anterior);
// - apontamento ligado a tarefa herda o projeto da tarefa;
// - sem "faturável" explícito, herda do projeto.
// As horas de tarefas e projetos ficam somadas nos próprios documentos (trackedSeconds)
// e são ajustadas aqui, no mesmo lote de cada mudança, com incremento atômico.
import {
  MAX_TIME_ENTRY_SECONDS,
  addDays,
  createTimeEntrySchema,
  startTimerSchema,
  timeEntriesQuerySchema,
  updateTimeEntrySchema,
  type CreateTimeEntryInput,
  type Id,
  type StartTimerInput,
  type TimeEntry,
  type UpdateTimeEntryInput,
} from '@ott/shared';
import { AppError, badRequest, forbidden, notFound, parse } from '../errors';
import { paths, type ProjectDoc, type TagDoc, type TaskDoc, type TimeEntryDoc, type UserDoc } from '../store/schema';
import { arrayUnion, Batch, increment, where } from '../store/types';
import { loadWorkspace, nowIso, requireUid, type Ctx } from './context';

/**
 * Janela extra para trás ao listar apontamentos que tocam um intervalo: pega o que
 * começou antes e ainda estava rodando ou terminou dentro dele.
 */
const LOOKBACK_DAYS = 7;

export function entrySeconds(start: string, stop: string | null, now = Date.now()): number {
  const end = stop ? Date.parse(stop) : now;
  return Math.max(0, Math.round((end - Date.parse(start)) / 1000));
}

export function toTimeEntry(doc: TimeEntryDoc, now = Date.now()): TimeEntry {
  return { ...doc, duration: entrySeconds(doc.start, doc.stop, now) };
}

/** Normaliza qualquer ISO com fuso para UTC (comparável como texto). */
const toUtc = (iso: string) => new Date(iso).toISOString();

interface Links {
  projectId: Id | null;
  taskId: Id | null;
  project: ProjectDoc | null;
  task: TaskDoc | null;
}

async function loadLinks(ctx: Ctx, workspaceId: Id, projectId: Id | null, taskId: Id | null): Promise<Links> {
  const [project, task] = await Promise.all([
    projectId ? ctx.store.get<ProjectDoc>(paths.projects(workspaceId), projectId) : null,
    taskId ? ctx.store.get<TaskDoc>(paths.tasks(workspaceId), taskId) : null,
  ]);
  return { projectId, taskId, project, task };
}

async function resolveLinks(ctx: Ctx, workspaceId: Id, projectId: Id | null, taskId: Id | null): Promise<Links> {
  if (taskId !== null) {
    const task = await ctx.store.get<TaskDoc>(paths.tasks(workspaceId), taskId);
    if (!task) throw notFound('Tarefa');
    const project = task.projectId ? await ctx.store.get<ProjectDoc>(paths.projects(workspaceId), task.projectId) : null;
    return { projectId: task.projectId, taskId, project, task };
  }
  if (projectId !== null) {
    const project = await ctx.store.get<ProjectDoc>(paths.projects(workspaceId), projectId);
    if (!project) throw notFound('Projeto');
    return { projectId, taskId: null, project, task: null };
  }
  return { projectId: null, taskId: null, project: null, task: null };
}

async function checkTags(ctx: Ctx, workspaceId: Id, tagIds: Id[] | undefined): Promise<void> {
  if (!tagIds || tagIds.length === 0) return;
  const known = new Set((await ctx.store.list<TagDoc>(paths.tags(workspaceId))).map((tag) => tag.id));
  if (tagIds.some((id) => !known.has(id))) throw notFound('Tag');
}

function checkRange(start: string, stop: string | null): void {
  if (stop === null) return;
  const seconds = (Date.parse(stop) - Date.parse(start)) / 1000;
  if (seconds < 0) throw badRequest('INVALID_RANGE', 'O fim é anterior ao início');
  if (seconds > MAX_TIME_ENTRY_SECONDS) throw badRequest('INVALID_RANGE', 'Duração acima do limite');
}

/** Soma as variações de horas por documento e grava um único incremento em cada. */
class TrackedTally {
  private readonly tasks = new Map<Id, number>();
  private readonly projects = new Map<Id, { seconds: number; trackers: Set<Id> }>();

  add(links: Pick<Links, 'task' | 'project'>, seconds: number, userId: Id): this {
    if (seconds === 0) return this;
    if (links.task) this.tasks.set(links.task.id, (this.tasks.get(links.task.id) ?? 0) + seconds);
    if (links.project) {
      const current = this.projects.get(links.project.id) ?? { seconds: 0, trackers: new Set<Id>() };
      current.seconds += seconds;
      if (seconds > 0) current.trackers.add(userId);
      this.projects.set(links.project.id, current);
    }
    return this;
  }

  write(batch: Batch, workspaceId: Id): void {
    for (const [id, seconds] of this.tasks) {
      if (seconds !== 0) batch.update(paths.tasks(workspaceId), id, { trackedSeconds: increment(seconds) });
    }
    for (const [id, { seconds, trackers }] of this.projects) {
      const data: Record<string, unknown> = {};
      if (seconds !== 0) data.trackedSeconds = increment(seconds);
      if (trackers.size > 0) data.trackerIds = arrayUnion(...trackers);
      batch.update(paths.projects(workspaceId), id, data);
    }
  }
}

export async function listTimeEntries(ctx: Ctx, workspaceId: Id, raw: { from: string; to: string }): Promise<TimeEntry[]> {
  const { uid } = await loadWorkspace(ctx, workspaceId);
  const query = parse(timeEntriesQuerySchema, raw);
  const from = toUtc(query.from);
  const to = toUtc(query.to);
  const since = `${addDays(from.slice(0, 10), -LOOKBACK_DAYS)}T00:00:00.000Z`;
  // Apontamentos de outra pessoa só aparecem nos relatórios; aqui é sempre o próprio.
  const docs = await ctx.store.list<TimeEntryDoc>(paths.timeEntries(workspaceId), [
    where('userId', '==', uid),
    where('start', '>=', since),
    where('start', '<', to),
  ]);
  const now = ctx.now().getTime();
  return docs
    .filter((doc) => doc.stop === null || doc.stop > from)
    .sort((a, b) => b.start.localeCompare(a.start))
    .map((doc) => toTimeEntry(doc, now));
}

/** Para o cronômetro rodando da pessoa (pode estar em outro workspace), no mesmo lote. */
async function stopRunning(ctx: Ctx, batch: Batch, user: UserDoc, at: string): Promise<void> {
  const pointer = user.runningEntry;
  if (!pointer) return;
  let entry: TimeEntryDoc | null = null;
  try {
    entry = await ctx.store.get<TimeEntryDoc>(paths.timeEntries(pointer.workspaceId), pointer.entryId);
  } catch (error) {
    // Sem acesso ao workspace do cronômetro antigo (saiu dele): só esquece o ponteiro.
    if (error instanceof AppError && error.code === 'FORBIDDEN') return;
    throw error;
  }
  if (!entry || entry.stop !== null) return;
  // Se o relógio adiantou o início, não gravamos duração negativa.
  const stop = at < entry.start ? entry.start : at;
  batch.update(paths.timeEntries(pointer.workspaceId), entry.id, { stop, updatedAt: at });
  const links = await loadLinks(ctx, pointer.workspaceId, entry.projectId, entry.taskId);
  new TrackedTally().add(links, entrySeconds(entry.start, stop), entry.userId).write(batch, pointer.workspaceId);
}

export async function startTimer(ctx: Ctx, workspaceId: Id, raw: StartTimerInput): Promise<TimeEntry> {
  const { uid } = await loadWorkspace(ctx, workspaceId);
  const input = parse(startTimerSchema, raw ?? {});
  await checkTags(ctx, workspaceId, input.tagIds);
  const links = await resolveLinks(ctx, workspaceId, input.projectId ?? null, input.taskId ?? null);
  const user = await ctx.store.get<UserDoc>(paths.users, uid);
  if (!user) throw new AppError('UNAUTHORIZED', 'Sessão inválida');
  const now = nowIso(ctx);
  const batch = new Batch();
  await stopRunning(ctx, batch, user, now);
  const entry: TimeEntryDoc = {
    id: ctx.store.newId(),
    workspaceId,
    userId: uid,
    projectId: links.projectId,
    taskId: links.taskId,
    description: input.description ?? '',
    start: now,
    stop: null,
    billable: input.billable ?? links.project?.billable ?? false,
    tagIds: [...new Set(input.tagIds ?? [])],
    createdAt: now,
    updatedAt: now,
  };
  batch.set(paths.timeEntries(workspaceId), entry.id, entry);
  batch.update(paths.users, uid, { runningEntry: { workspaceId, entryId: entry.id } });
  await ctx.store.commit(batch.ops);
  return toTimeEntry(entry, ctx.now().getTime());
}

export async function createTimeEntry(ctx: Ctx, workspaceId: Id, raw: CreateTimeEntryInput): Promise<TimeEntry> {
  const { uid } = await loadWorkspace(ctx, workspaceId);
  const input = parse(createTimeEntrySchema, raw);
  await checkTags(ctx, workspaceId, input.tagIds);
  const start = toUtc(input.start);
  const stop = toUtc(input.stop);
  checkRange(start, stop);
  const links = await resolveLinks(ctx, workspaceId, input.projectId ?? null, input.taskId ?? null);
  const now = nowIso(ctx);
  const entry: TimeEntryDoc = {
    id: ctx.store.newId(),
    workspaceId,
    userId: uid,
    projectId: links.projectId,
    taskId: links.taskId,
    description: input.description ?? '',
    start,
    stop,
    billable: input.billable ?? links.project?.billable ?? false,
    tagIds: [...new Set(input.tagIds ?? [])],
    createdAt: now,
    updatedAt: now,
  };
  const batch = new Batch().set(paths.timeEntries(workspaceId), entry.id, entry);
  new TrackedTally().add(links, entrySeconds(start, stop), uid).write(batch, workspaceId);
  await ctx.store.commit(batch.ops);
  return toTimeEntry(entry, ctx.now().getTime());
}

async function ownEntry(ctx: Ctx, workspaceId: Id, id: Id): Promise<{ uid: Id; entry: TimeEntryDoc }> {
  const { uid } = await loadWorkspace(ctx, workspaceId);
  const entry = await ctx.store.get<TimeEntryDoc>(paths.timeEntries(workspaceId), id);
  if (!entry) throw notFound('Apontamento');
  if (entry.userId !== uid) throw forbidden('Só é possível alterar os próprios apontamentos');
  return { uid, entry };
}

export async function updateTimeEntry(ctx: Ctx, workspaceId: Id, id: Id, raw: UpdateTimeEntryInput): Promise<TimeEntry> {
  const { uid, entry } = await ownEntry(ctx, workspaceId, id);
  const input = parse(updateTimeEntrySchema, raw);
  await checkTags(ctx, workspaceId, input.tagIds);
  const next: TimeEntryDoc = { ...entry };
  if (input.description !== undefined) next.description = input.description;
  if (input.billable !== undefined) next.billable = input.billable;
  if (input.tagIds !== undefined) next.tagIds = [...new Set(input.tagIds)];

  const before = await loadLinks(ctx, workspaceId, entry.projectId, entry.taskId);
  let after = before;
  if (input.taskId !== undefined || input.projectId !== undefined) {
    let taskId = input.taskId === undefined ? entry.taskId : input.taskId;
    const projectId = input.projectId === undefined ? entry.projectId : input.projectId;
    // Trocar de projeto solta a tarefa que pertencia ao projeto anterior.
    if (input.taskId === undefined && taskId !== null && projectId !== entry.projectId) taskId = null;
    after = await resolveLinks(ctx, workspaceId, projectId, taskId);
    next.projectId = after.projectId;
    next.taskId = after.taskId;
  }

  next.start = input.start !== undefined ? toUtc(input.start) : entry.start;
  if (input.stop !== undefined) {
    if (input.stop === null) {
      if (entry.stop !== null) throw badRequest('INVALID_RANGE', 'Use iniciar para retomar um apontamento');
    } else {
      next.stop = toUtc(input.stop);
    }
  }
  const now = nowIso(ctx);
  if (next.start > now && next.stop === null) {
    throw badRequest('INVALID_RANGE', 'O cronômetro não pode começar no futuro');
  }
  checkRange(next.start, next.stop);
  next.updatedAt = now;

  const { id: _id, ...fields } = next;
  const batch = new Batch().update(paths.timeEntries(workspaceId), id, fields);
  const tally = new TrackedTally();
  // Só apontamento encerrado conta nas horas da tarefa e do projeto.
  if (entry.stop !== null) tally.add(before, -entrySeconds(entry.start, entry.stop), uid);
  if (next.stop !== null) tally.add(after, entrySeconds(next.start, next.stop), uid);
  tally.write(batch, workspaceId);
  if (entry.stop === null && next.stop !== null) batch.update(paths.users, uid, { runningEntry: null });
  await ctx.store.commit(batch.ops);
  return toTimeEntry(next, ctx.now().getTime());
}

export async function stopTimeEntry(ctx: Ctx, workspaceId: Id, id: Id): Promise<TimeEntry> {
  const { uid, entry } = await ownEntry(ctx, workspaceId, id);
  if (entry.stop !== null) return toTimeEntry(entry, ctx.now().getTime());
  const user = await ctx.store.get<UserDoc>(paths.users, uid);
  const now = nowIso(ctx);
  const stop = now < entry.start ? entry.start : now;
  const batch = new Batch().update(paths.timeEntries(workspaceId), id, { stop, updatedAt: now });
  const links = await loadLinks(ctx, workspaceId, entry.projectId, entry.taskId);
  new TrackedTally().add(links, entrySeconds(entry.start, stop), uid).write(batch, workspaceId);
  if (user?.runningEntry?.entryId === id) batch.update(paths.users, uid, { runningEntry: null });
  await ctx.store.commit(batch.ops);
  return toTimeEntry({ ...entry, stop, updatedAt: now }, ctx.now().getTime());
}

export async function removeTimeEntry(ctx: Ctx, workspaceId: Id, id: Id): Promise<void> {
  const { uid, entry } = await ownEntry(ctx, workspaceId, id);
  const batch = new Batch().delete(paths.timeEntries(workspaceId), id);
  if (entry.stop !== null) {
    const links = await loadLinks(ctx, workspaceId, entry.projectId, entry.taskId);
    new TrackedTally().add(links, -entrySeconds(entry.start, entry.stop), uid).write(batch, workspaceId);
  } else {
    batch.update(paths.users, uid, { runningEntry: null });
  }
  await ctx.store.commit(batch.ops);
}

/** Para o cronômetro rodando (atalho da barra lateral e da barra do cronômetro). */
export async function stopRunningTimer(ctx: Ctx): Promise<void> {
  const uid = requireUid(ctx);
  const user = await ctx.store.get<UserDoc>(paths.users, uid);
  if (!user?.runningEntry) return;
  const batch = new Batch();
  await stopRunning(ctx, batch, user, nowIso(ctx));
  batch.update(paths.users, uid, { runningEntry: null });
  await ctx.store.commit(batch.ops);
}
