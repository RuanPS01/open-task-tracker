import { createWorkspaceSchema, updateWorkspaceSchema } from '@ott/shared';
import type { FastifyInstance } from 'fastify';
import { currentUser, currentWorkspace, requireAdmin, requireAuth } from '../../http/context';
import { parse } from '../../http/validation';
import { setCurrentWorkspace } from '../users/repo';
import { getWorkspaceForUser, insertWorkspace, listWorkspacesForUser, updateWorkspace } from './repo';

/** Rotas fora do escopo de um workspace: listar e criar. */
export async function workspaceCollectionRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app;

  app.get('/workspaces', { preHandler: requireAuth }, async (request) => {
    return listWorkspacesForUser(db, currentUser(request).id);
  });

  app.post('/workspaces', { preHandler: requireAuth }, async (request, reply) => {
    const user = currentUser(request);
    const input = parse(createWorkspaceSchema, request.body);
    const id = insertWorkspace(db, input.name, user.id);
    setCurrentWorkspace(db, user.id, id);
    reply.status(201);
    return getWorkspaceForUser(db, id, user.id);
  });
}

/** Rotas dentro de /workspaces/:workspaceId. */
export async function workspaceRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app;

  app.get('/', async (request) => currentWorkspace(request));

  app.patch('/', async (request) => {
    const workspace = requireAdmin(request);
    updateWorkspace(db, workspace.id, parse(updateWorkspaceSchema, request.body));
    return getWorkspaceForUser(db, workspace.id, currentUser(request).id);
  });
}
