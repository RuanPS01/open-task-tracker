import { createProjectSchema, updateProjectSchema } from '@ott/shared';
import type { FastifyInstance } from 'fastify';
import { badRequest, notFound } from '../../http/errors';
import { currentUser, currentWorkspace, idParams, requireAdmin } from '../../http/context';
import { parse } from '../../http/validation';
import { getClient } from '../clients/repo';
import { deleteProject, getProject, insertProject, listProjects, updateProject } from './repo';

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app;

  const checkClient = (workspaceId: number, clientId: number | null | undefined) => {
    if (clientId != null && !getClient(db, workspaceId, clientId)) throw notFound('Cliente');
  };
  const checkDates = (start: string | null | undefined, end: string | null | undefined) => {
    if (start && end && start > end) throw badRequest('INVALID_DATES', 'O início é posterior ao fim');
  };

  app.get('/projects', async (request) => {
    return listProjects(db, currentWorkspace(request).id, currentUser(request).id);
  });

  app.get('/projects/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    const project = getProject(db, currentWorkspace(request).id, id, currentUser(request).id);
    if (!project) throw notFound('Projeto');
    return project;
  });

  app.post('/projects', async (request, reply) => {
    const workspace = currentWorkspace(request);
    const input = parse(createProjectSchema, request.body);
    checkClient(workspace.id, input.clientId);
    checkDates(input.startDate, input.endDate);
    const id = insertProject(db, workspace.id, input);
    reply.status(201);
    return getProject(db, workspace.id, id, currentUser(request).id);
  });

  app.patch('/projects/:id', async (request) => {
    const workspace = currentWorkspace(request);
    const user = currentUser(request);
    const { id } = parse(idParams, request.params);
    const input = parse(updateProjectSchema, request.body);
    const current = getProject(db, workspace.id, id, user.id);
    if (!current) throw notFound('Projeto');
    checkClient(workspace.id, input.clientId);
    checkDates(
      input.startDate === undefined ? current.startDate : input.startDate,
      input.endDate === undefined ? current.endDate : input.endDate,
    );
    updateProject(db, workspace.id, id, user.id, input);
    return getProject(db, workspace.id, id, user.id);
  });

  // Excluir apaga tarefas do projeto e solta os apontamentos (ficam sem projeto).
  app.delete('/projects/:id', async (request, reply) => {
    const workspace = requireAdmin(request);
    const { id } = parse(idParams, request.params);
    if (!getProject(db, workspace.id, id, currentUser(request).id)) throw notFound('Projeto');
    deleteProject(db, workspace.id, id);
    reply.status(204);
  });
}
