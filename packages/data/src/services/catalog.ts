// Cadastros simples do workspace: clientes, tags e feriados.
import {
  brazilianHolidays,
  createClientSchema,
  createHolidaySchema,
  createTagSchema,
  importHolidaysSchema,
  updateClientSchema,
  updateTagSchema,
  type Client,
  type CreateClientInput,
  type CreateHolidayInput,
  type CreateTagInput,
  type Holiday,
  type Id,
  type ImportHolidaysInput,
  type Tag,
  type UpdateClientInput,
} from '@ott/shared';
import { conflict, notFound, parse } from '../errors';
import {
  paths,
  type ClientDoc,
  type HolidayDoc,
  type ProjectDoc,
  type TagDoc,
  type TaskDoc,
  type TimeEntryDoc,
} from '../store/schema';
import { arrayRemove, Batch, where } from '../store/types';
import { byName, loadAdminWorkspace, loadWorkspace, nowIso, type Ctx } from './context';
import { rescheduleWorkspace } from './tasks';

const sameName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;

// --- Clientes ----------------------------------------------------------------

export async function listClients(ctx: Ctx, workspaceId: Id): Promise<Client[]> {
  await loadWorkspace(ctx, workspaceId);
  const [clients, projects] = await Promise.all([
    ctx.store.list<ClientDoc>(paths.clients(workspaceId)),
    ctx.store.list<ProjectDoc>(paths.projects(workspaceId)),
  ]);
  return clients
    .map((client) => ({
      ...client,
      projectCount: projects.filter((project) => project.clientId === client.id && !project.archived).length,
    }))
    .sort(byName);
}

async function findClient(ctx: Ctx, workspaceId: Id, id: Id): Promise<Client> {
  const client = (await listClients(ctx, workspaceId)).find((item) => item.id === id);
  if (!client) throw notFound('Cliente');
  return client;
}

export async function createClient(ctx: Ctx, workspaceId: Id, raw: CreateClientInput): Promise<Client> {
  await loadWorkspace(ctx, workspaceId);
  const input = parse(createClientSchema, raw);
  const clients = await ctx.store.list<ClientDoc>(paths.clients(workspaceId));
  if (clients.some((client) => sameName(client.name, input.name))) {
    throw conflict('NAME_TAKEN', 'Já existe um cliente com esse nome');
  }
  const client: ClientDoc = { id: ctx.store.newId(), workspaceId, name: input.name, archived: false, createdAt: nowIso(ctx) };
  await ctx.store.commit(new Batch().set(paths.clients(workspaceId), client.id, client).ops);
  return { ...client, projectCount: 0 };
}

export async function updateClient(ctx: Ctx, workspaceId: Id, id: Id, raw: UpdateClientInput): Promise<Client> {
  await loadWorkspace(ctx, workspaceId);
  const input = parse(updateClientSchema, raw);
  const clients = await ctx.store.list<ClientDoc>(paths.clients(workspaceId));
  if (!clients.some((client) => client.id === id)) throw notFound('Cliente');
  if (input.name && clients.some((client) => client.id !== id && sameName(client.name, input.name!))) {
    throw conflict('NAME_TAKEN', 'Já existe um cliente com esse nome');
  }
  await ctx.store.commit(new Batch().update(paths.clients(workspaceId), id, input).ops);
  return findClient(ctx, workspaceId, id);
}

/** Excluir o cliente deixa os projetos dele sem cliente. */
export async function removeClient(ctx: Ctx, workspaceId: Id, id: Id): Promise<void> {
  await loadWorkspace(ctx, workspaceId);
  if (!(await ctx.store.get<ClientDoc>(paths.clients(workspaceId), id))) throw notFound('Cliente');
  const projects = await ctx.store.list<ProjectDoc>(paths.projects(workspaceId), [where('clientId', '==', id)]);
  const batch = new Batch().delete(paths.clients(workspaceId), id);
  const now = nowIso(ctx);
  for (const project of projects) batch.update(paths.projects(workspaceId), project.id, { clientId: null, updatedAt: now });
  await ctx.store.commit(batch.ops);
}

// --- Tags --------------------------------------------------------------------

export async function listTags(ctx: Ctx, workspaceId: Id): Promise<Tag[]> {
  await loadWorkspace(ctx, workspaceId);
  return (await ctx.store.list<TagDoc>(paths.tags(workspaceId))).sort(byName);
}

export async function createTag(ctx: Ctx, workspaceId: Id, raw: CreateTagInput): Promise<Tag> {
  await loadWorkspace(ctx, workspaceId);
  const { name } = parse(createTagSchema, raw);
  const tags = await ctx.store.list<TagDoc>(paths.tags(workspaceId));
  if (tags.some((tag) => tag.name === name)) throw conflict('NAME_TAKEN', 'Já existe uma tag com esse nome');
  const tag: TagDoc = { id: ctx.store.newId(), workspaceId, name, createdAt: nowIso(ctx) };
  await ctx.store.commit(new Batch().set(paths.tags(workspaceId), tag.id, tag).ops);
  return tag;
}

export async function renameTag(ctx: Ctx, workspaceId: Id, id: Id, raw: CreateTagInput): Promise<Tag> {
  await loadWorkspace(ctx, workspaceId);
  const { name } = parse(updateTagSchema, raw);
  const tags = await ctx.store.list<TagDoc>(paths.tags(workspaceId));
  const tag = tags.find((item) => item.id === id);
  if (!tag) throw notFound('Tag');
  if (tags.some((item) => item.id !== id && item.name === name)) {
    throw conflict('NAME_TAKEN', 'Já existe uma tag com esse nome');
  }
  await ctx.store.commit(new Batch().update(paths.tags(workspaceId), id, { name }).ops);
  return { ...tag, name };
}

/** Excluir a tag tira ela das tarefas e dos apontamentos (de todas as pessoas). */
export async function removeTag(ctx: Ctx, workspaceId: Id, id: Id): Promise<void> {
  await loadWorkspace(ctx, workspaceId);
  if (!(await ctx.store.get<TagDoc>(paths.tags(workspaceId), id))) throw notFound('Tag');
  const [tasks, entries] = await Promise.all([
    ctx.store.list<TaskDoc>(paths.tasks(workspaceId), [where('tagIds', 'array-contains', id)]),
    ctx.store.list<TimeEntryDoc>(paths.timeEntries(workspaceId), [where('tagIds', 'array-contains', id)]),
  ]);
  const now = nowIso(ctx);
  const batch = new Batch().delete(paths.tags(workspaceId), id);
  for (const task of tasks) batch.update(paths.tasks(workspaceId), task.id, { tagIds: arrayRemove(id), updatedAt: now });
  for (const entry of entries) {
    batch.update(paths.timeEntries(workspaceId), entry.id, { tagIds: arrayRemove(id), updatedAt: now });
  }
  await ctx.store.commit(batch.ops);
}

// --- Feriados ------------------------------------------------------------------
// Entram no calendário de trabalho como dias não úteis (Gantt, cascata, caminho
// crítico e capacidade). Só administradores alteram.

export async function listHolidays(ctx: Ctx, workspaceId: Id): Promise<Holiday[]> {
  await loadWorkspace(ctx, workspaceId);
  return (await ctx.store.list<HolidayDoc>(paths.holidays(workspaceId))).sort((a, b) => a.date.localeCompare(b.date));
}

export async function createHoliday(ctx: Ctx, workspaceId: Id, raw: CreateHolidayInput): Promise<Holiday> {
  await loadAdminWorkspace(ctx, workspaceId);
  const input = parse(createHolidaySchema, raw);
  if (await ctx.store.get<HolidayDoc>(paths.holidays(workspaceId), input.date)) {
    throw conflict('DATE_TAKEN', 'Já existe um feriado nesta data');
  }
  const holiday: HolidayDoc = { id: input.date, workspaceId, date: input.date, name: input.name };
  await ctx.store.commit(new Batch().set(paths.holidays(workspaceId), holiday.id, holiday).ops);
  await rescheduleWorkspace(ctx, workspaceId);
  return holiday;
}

/** Importa os feriados nacionais do Brasil de um ano; datas já cadastradas ficam como estão. */
export async function importHolidays(
  ctx: Ctx,
  workspaceId: Id,
  raw: ImportHolidaysInput,
): Promise<{ created: number; holidays: Holiday[] }> {
  await loadAdminWorkspace(ctx, workspaceId);
  const input = parse(importHolidaysSchema, raw);
  const existing = new Set((await ctx.store.list<HolidayDoc>(paths.holidays(workspaceId))).map((h) => h.date));
  const batch = new Batch();
  for (const seed of brazilianHolidays(input.year, input.includeOptional)) {
    if (existing.has(seed.date)) continue;
    existing.add(seed.date);
    batch.set(paths.holidays(workspaceId), seed.date, { id: seed.date, workspaceId, date: seed.date, name: seed.name });
  }
  await ctx.store.commit(batch.ops);
  if (batch.size > 0) await rescheduleWorkspace(ctx, workspaceId);
  return { created: batch.size, holidays: await listHolidays(ctx, workspaceId) };
}

export async function removeHoliday(ctx: Ctx, workspaceId: Id, id: Id): Promise<void> {
  await loadAdminWorkspace(ctx, workspaceId);
  if (!(await ctx.store.get<HolidayDoc>(paths.holidays(workspaceId), id))) throw notFound('Feriado');
  await ctx.store.commit(new Batch().delete(paths.holidays(workspaceId), id).ops);
}
