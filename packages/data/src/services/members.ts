// Membros e convites. Sem servidor próprio não há como criar a conta de outra pessoa
// (nem enviar e-mail), então a entrada no workspace é por link de convite: o admin
// gera o link, a pessoa entra com a própria conta e aceita. O link vale uma vez.
import {
  DEFAULT_WEEKLY_CAPACITY_HOURS,
  createInviteSchema,
  updateMemberSchema,
  type CreateInviteInput,
  type Id,
  type Invite,
  type Member,
  type UpdateMemberInput,
} from '@ott/shared';
import { AppError, badRequest, conflict, notFound, parse } from '../errors';
import { paths, type InviteDoc, type MemberDoc, type TaskDoc, type UserDoc, type WorkspaceDoc } from '../store/schema';
import { arrayRemove, arrayUnion, Batch, where } from '../store/types';
import { byName, loadAdminWorkspace, loadWorkspace, nowIso, requireUid, type Ctx } from './context';

const toMember = ({ inviteId: _inviteId, ...member }: MemberDoc): Member => member;

export async function listMembers(ctx: Ctx, workspaceId: Id): Promise<Member[]> {
  await loadWorkspace(ctx, workspaceId);
  return (await ctx.store.list<MemberDoc>(paths.members(workspaceId))).map(toMember).sort(byName);
}

/** Listas de acesso do workspace (usadas pelas regras do Firestore) a partir dos membros. */
function accessLists(members: readonly MemberDoc[]): Pick<WorkspaceDoc, 'memberIds' | 'adminIds'> {
  const active = members.filter((member) => member.active);
  return {
    memberIds: active.map((member) => member.userId),
    adminIds: active.filter((member) => member.role === 'admin').map((member) => member.userId),
  };
}

const lastAdmin = () => badRequest('LAST_ADMIN', 'O workspace precisa de pelo menos um administrador ativo');

export async function updateMember(ctx: Ctx, workspaceId: Id, userId: Id, raw: UpdateMemberInput): Promise<Member> {
  await loadAdminWorkspace(ctx, workspaceId);
  const input = parse(updateMemberSchema, raw);
  const members = await ctx.store.list<MemberDoc>(paths.members(workspaceId));
  const member = members.find((item) => item.userId === userId);
  if (!member) throw notFound('Membro');
  const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
  const next: MemberDoc = { ...member, ...changes };
  const lists = accessLists(members.map((item) => (item.userId === userId ? next : item)));
  if (lists.adminIds.length === 0) throw lastAdmin();
  const batch = new Batch().update(paths.members(workspaceId), userId, changes);
  if (input.role !== undefined || input.active !== undefined) batch.update(paths.workspaces, workspaceId, lists);
  await ctx.store.commit(batch.ops);
  return toMember(next);
}

export async function removeMember(ctx: Ctx, workspaceId: Id, userId: Id): Promise<void> {
  const { uid } = await loadAdminWorkspace(ctx, workspaceId);
  const members = await ctx.store.list<MemberDoc>(paths.members(workspaceId));
  const member = members.find((item) => item.userId === userId);
  if (!member) throw notFound('Membro');
  const lists = accessLists(members.filter((item) => item.userId !== userId));
  if (member.role === 'admin' && lists.adminIds.length === 0) throw lastAdmin();
  if (userId === uid) throw badRequest('REMOVE_SELF', 'Peça a outro administrador para remover você');
  const tasks = await ctx.store.list<TaskDoc>(paths.tasks(workspaceId), [where('assigneeIds', 'array-contains', userId)]);
  const now = nowIso(ctx);
  const batch = new Batch().delete(paths.members(workspaceId), userId).update(paths.workspaces, workspaceId, lists);
  for (const task of tasks) {
    batch.update(paths.tasks(workspaceId), task.id, { assigneeIds: arrayRemove(userId), updatedAt: now });
  }
  await ctx.store.commit(batch.ops);
}

// --- Convites ----------------------------------------------------------------

export async function listInvites(ctx: Ctx, workspaceId: Id): Promise<Invite[]> {
  await loadAdminWorkspace(ctx, workspaceId);
  const invites = await ctx.store.list<InviteDoc>(paths.invites(workspaceId));
  return invites.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createInvite(ctx: Ctx, workspaceId: Id, raw: CreateInviteInput): Promise<Invite> {
  const { uid, doc } = await loadAdminWorkspace(ctx, workspaceId);
  const input = parse(createInviteSchema, raw);
  if (input.email) {
    const members = await ctx.store.list<MemberDoc>(paths.members(workspaceId));
    if (members.some((member) => member.email === input.email)) {
      throw conflict('ALREADY_MEMBER', 'Esta pessoa já é membro do workspace');
    }
  }
  const invite: InviteDoc = {
    // O id é o segredo do link: longo e aleatório para não ser adivinhado.
    id: `${ctx.store.newId()}${ctx.store.newId()}`,
    workspaceId,
    workspaceName: doc.name,
    email: input.email ?? null,
    role: input.role,
    weeklyCapacityHours: input.weeklyCapacityHours ?? DEFAULT_WEEKLY_CAPACITY_HOURS,
    hourlyRate: input.hourlyRate ?? null,
    createdBy: uid,
    createdAt: nowIso(ctx),
  };
  await ctx.store.commit(new Batch().set(paths.invites(workspaceId), invite.id, invite).ops);
  return invite;
}

export async function revokeInvite(ctx: Ctx, workspaceId: Id, inviteId: Id): Promise<void> {
  await loadAdminWorkspace(ctx, workspaceId);
  await ctx.store.commit(new Batch().delete(paths.invites(workspaceId), inviteId).ops);
}

const inviteNotFound = () => new AppError('INVITE_NOT_FOUND', 'Convite não encontrado ou já usado');

/** Lê o convite pelo link. Qualquer pessoa logada que tenha o link consegue ler. */
export async function getInvite(ctx: Ctx, workspaceId: Id, inviteId: Id): Promise<Invite> {
  requireUid(ctx);
  let invite: InviteDoc | null = null;
  try {
    invite = await ctx.store.get<InviteDoc>(paths.invites(workspaceId), inviteId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'FORBIDDEN') throw inviteNotFound();
    throw error;
  }
  if (!invite) throw inviteNotFound();
  return invite;
}

/** Entra no workspace com o convite: cria o membro, libera o acesso e consome o link. */
export async function acceptInvite(ctx: Ctx, workspaceId: Id, inviteId: Id): Promise<Id> {
  const uid = requireUid(ctx);
  const invite = await getInvite(ctx, workspaceId, inviteId);
  const [user, existing] = await Promise.all([
    ctx.store.get<UserDoc>(paths.users, uid),
    ctx.store.get<MemberDoc>(paths.members(workspaceId), uid),
  ]);
  if (!user) throw new AppError('UNAUTHORIZED', 'Sessão inválida');
  if (existing) throw conflict('ALREADY_MEMBER', 'Você já faz parte deste workspace');
  const member: MemberDoc = {
    userId: uid,
    workspaceId,
    name: user.name,
    email: user.email,
    avatarColor: user.avatarColor,
    role: invite.role,
    weeklyCapacityHours: invite.weeklyCapacityHours,
    hourlyRate: invite.hourlyRate,
    active: true,
    joinedAt: nowIso(ctx),
    inviteId,
  };
  const access: Record<string, unknown> = { memberIds: arrayUnion(uid) };
  if (invite.role === 'admin') access.adminIds = arrayUnion(uid);
  const batch = new Batch()
    .set(paths.members(workspaceId), uid, member)
    .update(paths.workspaces, workspaceId, access)
    .delete(paths.invites(workspaceId), inviteId)
    .update(paths.users, uid, { currentWorkspaceId: workspaceId });
  await ctx.store.commit(batch.ops);
  return workspaceId;
}
