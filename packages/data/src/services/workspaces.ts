import {
  DEFAULT_WEEKLY_CAPACITY_HOURS,
  DEFAULT_WORKING_DAYS,
  createWorkspaceSchema,
  updateWorkspaceSchema,
  type CreateWorkspaceInput,
  type Id,
  type UpdateWorkspaceInput,
  type Workspace,
} from '@ott/shared';
import { parse } from '../errors';
import { paths, type MemberDoc, type UserDoc, type WorkspaceDoc } from '../store/schema';
import { Batch, where } from '../store/types';
import { byName, loadAdminWorkspace, nowIso, requireUid, toWorkspace, type Ctx } from './context';
import { seedDemoWorkspace } from './demo';
import { rescheduleWorkspace } from './tasks';

export async function listWorkspacesFor(ctx: Ctx, uid: Id): Promise<Workspace[]> {
  const docs = await ctx.store.list<WorkspaceDoc>(paths.workspaces, [where('memberIds', 'array-contains', uid)]);
  return docs.map((doc) => toWorkspace(doc, uid)).sort(byName);
}

/** Documentos de um workspace novo, com quem cria como administrador e workspace atual. */
export function addWorkspaceOps(
  batch: Batch,
  input: { id: Id; name: string; owner: Pick<UserDoc, 'id' | 'name' | 'email' | 'avatarColor'>; now: string },
): WorkspaceDoc {
  const { id, name, owner, now } = input;
  const workspace: WorkspaceDoc = {
    id,
    name,
    currency: 'BRL',
    defaultHourlyRate: null,
    workingDays: [...DEFAULT_WORKING_DAYS],
    autoSchedule: true,
    memberIds: [owner.id],
    adminIds: [owner.id],
    createdBy: owner.id,
    createdAt: now,
  };
  const member: MemberDoc = {
    userId: owner.id,
    workspaceId: id,
    name: owner.name,
    email: owner.email,
    avatarColor: owner.avatarColor,
    role: 'admin',
    weeklyCapacityHours: DEFAULT_WEEKLY_CAPACITY_HOURS,
    hourlyRate: null,
    active: true,
    joinedAt: now,
  };
  batch.set(paths.workspaces, id, workspace);
  batch.set(paths.members(id), owner.id, member);
  batch.update(paths.users, owner.id, { currentWorkspaceId: id });
  return workspace;
}

export async function createWorkspace(ctx: Ctx, raw: CreateWorkspaceInput, options: { demo?: boolean } = {}): Promise<Workspace> {
  const uid = requireUid(ctx);
  const input = parse(createWorkspaceSchema, raw);
  const owner = await ctx.store.get<UserDoc>(paths.users, uid);
  if (!owner) throw new Error('Perfil não encontrado');
  const batch = new Batch();
  const doc = addWorkspaceOps(batch, { id: ctx.store.newId(), name: input.name, owner, now: nowIso(ctx) });
  await ctx.store.commit(batch.ops);
  if (options.demo) await seedDemoWorkspace(ctx, doc.id);
  const saved = (await ctx.store.get<WorkspaceDoc>(paths.workspaces, doc.id)) ?? doc;
  return toWorkspace(saved, uid);
}

export async function updateWorkspace(ctx: Ctx, workspaceId: Id, raw: UpdateWorkspaceInput): Promise<Workspace> {
  const { uid, doc } = await loadAdminWorkspace(ctx, workspaceId);
  const input = parse(updateWorkspaceSchema, raw);
  const changes: Partial<WorkspaceDoc> = {};
  if (input.name !== undefined) changes.name = input.name;
  if (input.currency !== undefined) changes.currency = input.currency;
  if (input.defaultHourlyRate !== undefined) changes.defaultHourlyRate = input.defaultHourlyRate;
  if (input.workingDays !== undefined) changes.workingDays = [...input.workingDays].sort((a, b) => a - b);
  if (input.autoSchedule !== undefined) changes.autoSchedule = input.autoSchedule;
  await ctx.store.commit(new Batch().update(paths.workspaces, workspaceId, changes).ops);
  // Dias úteis e agendamento automático mudam as datas calculadas do cronograma.
  const calendarChanged =
    (changes.workingDays !== undefined && changes.workingDays.join() !== doc.workingDays.join()) ||
    (changes.autoSchedule === true && !doc.autoSchedule);
  if (calendarChanged) await rescheduleWorkspace(ctx, workspaceId);
  return toWorkspace({ ...doc, ...changes }, uid);
}
