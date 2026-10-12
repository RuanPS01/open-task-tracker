// Tipos adicionados ao Fastify e guardas reutilizadas pelas rotas.
import type { User, Workspace } from '@ott/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config';
import type { Db } from '../db/database';
import { getWorkspaceForUser } from '../modules/workspaces/repo';
import { forbidden, notFound, unauthorized } from './errors';
import { parse } from './validation';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    config: AppConfig;
  }
  interface FastifyRequest {
    user: User | null;
    sessionToken: string | null;
    workspace: Workspace | null;
  }
}

export function currentUser(request: FastifyRequest): User {
  if (!request.user) throw unauthorized();
  return request.user;
}

export function currentWorkspace(request: FastifyRequest): Workspace {
  if (!request.workspace) throw notFound('Workspace');
  return request.workspace;
}

export function requireAdmin(request: FastifyRequest): Workspace {
  const workspace = currentWorkspace(request);
  if (workspace.role !== 'admin') throw forbidden('Apenas administradores podem fazer isso');
  return workspace;
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  currentUser(request);
}

const workspaceParams = z.object({ workspaceId: z.coerce.number().int().positive() });

/**
 * Carrega o workspace da URL e confirma que o usuário é membro ativo. Responde 404
 * (e não 403) para não revelar a existência de workspaces de outras pessoas.
 */
export async function requireWorkspace(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const user = currentUser(request);
  const { workspaceId } = parse(workspaceParams, request.params);
  const workspace = getWorkspaceForUser(request.server.db, workspaceId, user.id);
  if (!workspace) throw notFound('Workspace');
  request.workspace = workspace;
}

export const idParams = z.object({ id: z.coerce.number().int().positive() });
