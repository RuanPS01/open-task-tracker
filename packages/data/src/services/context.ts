// Contexto comum dos serviços: armazenamento, autenticação e relógio, mais as guardas
// que antes ficavam nas rotas da API (login, workspace do usuário, administrador).
import type { Id, Workspace } from '@ott/shared';
import type { AuthGateway } from '../auth/types';
import { forbidden, notFound, unauthorized } from '../errors';
import { paths, type WorkspaceDoc } from '../store/schema';
import type { DocStore } from '../store/types';

export interface Ctx {
  store: DocStore;
  auth: AuthGateway;
  /** Relógio injetável: os testes e a demonstração fixam "agora". */
  now(): Date;
}

export const nowIso = (ctx: Ctx) => ctx.now().toISOString();

export function requireUid(ctx: Ctx): Id {
  const uid = ctx.auth.currentUid();
  if (!uid) throw unauthorized();
  return uid;
}

export function toWorkspace(doc: WorkspaceDoc, uid: Id): Workspace {
  return {
    id: doc.id,
    name: doc.name,
    currency: doc.currency,
    defaultHourlyRate: doc.defaultHourlyRate,
    workingDays: [...doc.workingDays].sort((a, b) => a - b),
    autoSchedule: doc.autoSchedule,
    role: doc.adminIds.includes(uid) ? 'admin' : 'member',
    createdAt: doc.createdAt,
  };
}

export interface WorkspaceAccess {
  uid: Id;
  doc: WorkspaceDoc;
  workspace: Workspace;
}

/**
 * Carrega o workspace e confirma que a pessoa é membro ativo. Responde "não
 * encontrado" (e não "proibido") para não revelar workspaces de outras pessoas.
 */
export async function loadWorkspace(ctx: Ctx, workspaceId: Id): Promise<WorkspaceAccess> {
  const uid = requireUid(ctx);
  let doc: WorkspaceDoc | null = null;
  try {
    doc = await ctx.store.get<WorkspaceDoc>(paths.workspaces, workspaceId);
  } catch (error) {
    // No Firestore, quem não é membro nem consegue ler o documento.
    if ((error as { code?: string }).code === 'FORBIDDEN') throw notFound('Workspace');
    throw error;
  }
  if (!doc || !doc.memberIds.includes(uid)) throw notFound('Workspace');
  return { uid, doc, workspace: toWorkspace(doc, uid) };
}

export async function loadAdminWorkspace(ctx: Ctx, workspaceId: Id): Promise<WorkspaceAccess> {
  const access = await loadWorkspace(ctx, workspaceId);
  if (access.workspace.role !== 'admin') throw forbidden('Apenas administradores podem fazer isso');
  return access;
}

/** Ordena por nome sem diferenciar maiúsculas nem acentos. */
export const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
