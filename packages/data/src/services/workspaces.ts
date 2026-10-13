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
  input: {
    id: Id;
    name: string;
    color?: string | null;
    owner: Pick<UserDoc, 'id' | 'name' | 'email' | 'avatarColor'>;
    now: string;
  },
): WorkspaceDoc {
  const { id, name, owner, now } = input;
  const workspace: WorkspaceDoc = {
    id,
    name,
    currency: 'BRL',
    defaultHourlyRate: null,
    workingDays: [...DEFAULT_WORKING_DAYS],
    autoSchedule: true,
    color: input.color ?? null,
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
  const doc = addWorkspaceOps(batch, { id: ctx.store.newId(), name: input.name, color: input.color, owner, now: nowIso(ctx) });
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
  if (input.color !== undefined) changes.color = input.color;
  await ctx.store.commit(new Batch().update(paths.workspaces, workspaceId, changes).ops);
  // Dias úteis e agendamento automático mudam as datas calculadas do cronograma.
  const calendarChanged =
    (changes.workingDays !== undefined && changes.workingDays.join() !== doc.workingDays.join()) ||
    (changes.autoSchedule === true && !doc.autoSchedule);
  if (calendarChanged) await rescheduleWorkspace(ctx, workspaceId);
  return toWorkspace({ ...doc, ...changes }, uid);
}

// Tudo o que fica sob workspaces/{id}. Coleção nova de workspace entra aqui também, ou a
// exclusão do workspace deixa os documentos dela para trás.
const WORKSPACE_COLLECTIONS = [
  paths.timeEntries,
  paths.dependencies,
  paths.tasks,
  paths.projects,
  paths.tags,
  paths.clients,
  paths.holidays,
  paths.invites,
  paths.members,
] as const;

/**
 * Exclui o workspace e tudo o que está sob ele (só administrador). O documento do
 * workspace vai por último: no Firestore o lote grande é gravado em partes e as regras de
 * cada parte ainda consultam memberIds e adminIds dele. Se uma parte falhar, o workspace
 * continua existindo e a exclusão pode ser repetida.
 */
export async function deleteWorkspace(ctx: Ctx, workspaceId: Id): Promise<void> {
  const { uid } = await loadAdminWorkspace(ctx, workspaceId);
  const [collections, user, workspaces] = await Promise.all([
    Promise.all(WORKSPACE_COLLECTIONS.map((path) => ctx.store.list<{ id?: Id; userId?: Id }>(path(workspaceId)))),
    ctx.store.get<UserDoc>(paths.users, uid),
    listWorkspacesFor(ctx, uid),
  ]);
  const batch = new Batch();
  WORKSPACE_COLLECTIONS.forEach((path, index) => {
    // O documento de membro não guarda o campo id: o id dele é o uid da pessoa.
    for (const doc of collections[index]!) batch.delete(path(workspaceId), (path === paths.members ? doc.userId : doc.id)!);
  });
  // Só o perfil de quem exclui é corrigido aqui (as regras não deixam gravar o de outra
  // pessoa). Para os outros membros, a sessão troca o workspace atual que sumiu e o
  // cronômetro que rodava nele deixa de aparecer (getSession e runningTimer).
  if (user) {
    const projectIds = new Set(collections[WORKSPACE_COLLECTIONS.indexOf(paths.projects)]!.map((doc) => doc.id));
    const changes: Partial<UserDoc> = {};
    if (user.currentWorkspaceId === workspaceId) {
      changes.currentWorkspaceId = workspaces.find((workspace) => workspace.id !== workspaceId)?.id ?? null;
    }
    if (user.runningEntry?.workspaceId === workspaceId) changes.runningEntry = null;
    if (user.pinnedProjectIds.some((id) => projectIds.has(id))) {
      changes.pinnedProjectIds = user.pinnedProjectIds.filter((id) => !projectIds.has(id));
    }
    batch.update(paths.users, uid, changes);
  }
  batch.delete(paths.workspaces, workspaceId);
  await ctx.store.commit(batch.ops);
}
