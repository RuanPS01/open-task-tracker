// Sessão e perfil: cadastro, login, preferências e workspace atual.
import {
  changePasswordSchema,
  googleLoginSchema,
  loginSchema,
  signupSchema,
  switchWorkspaceSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type GoogleLoginInput,
  type Id,
  type LoginInput,
  type SessionResponse,
  type SignupInput,
  type TimeEntry,
  type UpdateProfileInput,
} from '@ott/shared';
import { AppError, badRequest, parse } from '../errors';
import { paths, type MemberDoc, type TimeEntryDoc, type UserDoc } from '../store/schema';
import { Batch } from '../store/types';
import { loadWorkspace, nowIso, requireUid, type Ctx } from './context';
import { toTimeEntry } from './timeEntries';
import { newUserDoc, toUser } from './users';
import { addWorkspaceOps, listWorkspacesFor } from './workspaces';

type NewAccountPreferences = Pick<GoogleLoginInput, 'locale' | 'timezone'>;

/** Perfil e workspace padrão de quem acabou de criar a conta (cadastro ou Google). */
function addAccountOps(batch: Batch, ctx: Ctx, user: UserDoc, locale: string | undefined, workspaceName?: string): void {
  const name = workspaceName ?? (locale === 'en' ? `${user.name}'s workspace` : `Workspace de ${user.name}`);
  batch.set(paths.users, user.id, user);
  addWorkspaceOps(batch, { id: ctx.store.newId(), name, owner: user, now: user.createdAt });
}

/**
 * Sessão atual ou null quando ninguém entrou. Conta de login sem perfil (primeira
 * entrada pelo Google, ou cadastro que caiu no meio) ganha o perfil e o workspace padrão.
 */
export async function getSession(ctx: Ctx, newAccount: NewAccountPreferences = {}): Promise<SessionResponse | null> {
  const uid = ctx.auth.currentUid();
  if (!uid) return null;
  let user = await ctx.store.get<UserDoc>(paths.users, uid);
  if (!user) {
    const email = (ctx.auth.currentEmail() ?? '').toLowerCase();
    const name = ctx.auth.currentName()?.trim().slice(0, 80) || email.split('@')[0] || email;
    const preferences = {
      ...(newAccount.locale ? { locale: newAccount.locale } : {}),
      ...(newAccount.timezone ? { timezone: newAccount.timezone } : {}),
    };
    user = newUserDoc(uid, { name, email, preferences }, nowIso(ctx));
    const batch = new Batch();
    addAccountOps(batch, ctx, user, newAccount.locale);
    await ctx.store.commit(batch.ops);
  }
  const workspaces = await listWorkspacesFor(ctx, uid);
  const currentId = user.currentWorkspaceId;
  // Workspace atual removido ou desativado: cai no primeiro disponível.
  if (!workspaces.some((workspace) => workspace.id === currentId)) {
    const next = workspaces[0]?.id ?? null;
    if (next !== currentId) {
      await ctx.store.commit(new Batch().update(paths.users, uid, { currentWorkspaceId: next }).ops);
      user = { ...user, currentWorkspaceId: next };
    }
  }
  return { user: toUser(user), workspaces };
}

async function requireSession(ctx: Ctx, newAccount?: NewAccountPreferences): Promise<SessionResponse> {
  const session = await getSession(ctx, newAccount);
  if (!session) throw new AppError('UNAUTHORIZED', 'Sessão inválida');
  return session;
}

export async function signup(ctx: Ctx, raw: SignupInput): Promise<SessionResponse> {
  const input = parse(signupSchema, raw);
  const uid = await ctx.auth.signUp(input.email, input.password);
  const now = nowIso(ctx);
  const user = newUserDoc(
    uid,
    {
      name: input.name,
      email: input.email,
      preferences: {
        ...(input.locale ? { locale: input.locale } : {}),
        ...(input.timezone ? { timezone: input.timezone } : {}),
      },
    },
    now,
  );
  const batch = new Batch();
  addAccountOps(batch, ctx, user, input.locale, input.workspaceName);
  await ctx.store.commit(batch.ops);
  return requireSession(ctx);
}

/** Entra pelo Google; na primeira vez cria o perfil (nome do Google) e o workspace padrão. */
export async function loginWithGoogle(ctx: Ctx, raw: GoogleLoginInput = {}): Promise<SessionResponse> {
  const input = parse(googleLoginSchema, raw);
  await ctx.auth.signInWithGoogle();
  return requireSession(ctx, input);
}

export async function login(ctx: Ctx, raw: LoginInput): Promise<SessionResponse> {
  const input = parse(loginSchema, raw);
  await ctx.auth.signIn(input.email, input.password);
  return requireSession(ctx);
}

export async function logout(ctx: Ctx): Promise<void> {
  await ctx.auth.signOut();
}

export async function updateProfile(ctx: Ctx, raw: UpdateProfileInput): Promise<SessionResponse> {
  const uid = requireUid(ctx);
  const input = parse(updateProfileSchema, raw);
  const user = await ctx.store.get<UserDoc>(paths.users, uid);
  if (!user) throw new AppError('UNAUTHORIZED', 'Sessão inválida');
  if (input.preferences?.timezone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: input.preferences.timezone });
    } catch {
      throw badRequest('INVALID_TIMEZONE', 'Fuso horário inválido');
    }
  }
  const emailChanged = input.email !== undefined && input.email !== user.email;
  if (emailChanged) {
    if (!ctx.auth.canChangeEmail) throw badRequest('EMAIL_CHANGE_UNSUPPORTED', 'Troca de e-mail indisponível');
    await ctx.auth.changeEmail(input.email!);
  }
  const changes: Partial<UserDoc> = {};
  if (input.name !== undefined) changes.name = input.name;
  if (emailChanged) changes.email = input.email!;
  if (input.preferences) changes.preferences = { ...user.preferences, ...input.preferences };
  const batch = new Batch().update(paths.users, uid, changes);
  // Nome e e-mail também aparecem na lista de membros de cada workspace.
  if (changes.name !== undefined || changes.email !== undefined) {
    const profile: Partial<MemberDoc> = {};
    if (changes.name !== undefined) profile.name = changes.name;
    if (changes.email !== undefined) profile.email = changes.email;
    for (const workspace of await listWorkspacesFor(ctx, uid)) batch.update(paths.members(workspace.id), uid, profile);
  }
  await ctx.store.commit(batch.ops);
  return requireSession(ctx);
}

export async function changePassword(ctx: Ctx, raw: ChangePasswordInput): Promise<void> {
  requireUid(ctx);
  const input = parse(changePasswordSchema, raw);
  await ctx.auth.changePassword(input.currentPassword, input.newPassword);
}

export async function switchWorkspace(ctx: Ctx, raw: { workspaceId: Id }): Promise<SessionResponse> {
  const { workspaceId } = parse(switchWorkspaceSchema, raw);
  const { uid } = await loadWorkspace(ctx, workspaceId);
  await ctx.store.commit(new Batch().update(paths.users, uid, { currentWorkspaceId: workspaceId }).ops);
  return requireSession(ctx);
}

/** Cronômetro rodando da pessoa, em qualquer workspace (regra global do Toggl). */
export async function runningTimer(ctx: Ctx): Promise<TimeEntry | null> {
  const uid = requireUid(ctx);
  const user = await ctx.store.get<UserDoc>(paths.users, uid);
  const pointer = user?.runningEntry;
  if (!pointer) return null;
  try {
    const entry = await ctx.store.get<TimeEntryDoc>(paths.timeEntries(pointer.workspaceId), pointer.entryId);
    return entry && entry.stop === null ? toTimeEntry(entry, ctx.now().getTime()) : null;
  } catch (error) {
    // Saiu do workspace com o cronômetro rodando: não há mais acesso ao apontamento.
    if (error instanceof AppError && error.code === 'FORBIDDEN') return null;
    throw error;
  }
}
