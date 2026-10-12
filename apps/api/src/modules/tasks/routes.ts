import {
  createDependencySchema,
  createTaskSchema,
  scheduleTasksSchema,
  updateDependencySchema,
  updateTaskSchema,
} from '@ott/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../../http/errors';
import { currentUser, currentWorkspace, idParams } from '../../http/context';
import { parse } from '../../http/validation';
import { getTask, getTasksByIds, listDependencies, listTasks } from './repo';
import {
  changeDependency,
  createDependency,
  createTask,
  removeDependency,
  removeTask,
  scheduleTasks,
  updateTask,
} from './service';

const taskQuery = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  assigneeId: z.coerce.number().int().positive().optional(),
});

const dependencyQuery = z.object({ projectId: z.coerce.number().int().positive().optional() });

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app;

  app.get('/tasks', async (request) => {
    return listTasks(db, currentWorkspace(request).id, parse(taskQuery, request.query));
  });

  app.get('/tasks/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    const task = getTask(db, currentWorkspace(request).id, id);
    if (!task) throw notFound('Tarefa');
    return task;
  });

  app.post('/tasks', async (request, reply) => {
    const task = createTask(db, currentWorkspace(request), currentUser(request).id, parse(createTaskSchema, request.body));
    reply.status(201);
    return task;
  });

  app.patch('/tasks/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    return updateTask(db, currentWorkspace(request), id, parse(updateTaskSchema, request.body));
  });

  /** Lote de datas vindo do Gantt; devolve todas as tarefas que mudaram, inclusive pela cascata. */
  app.post('/tasks/schedule', async (request) => {
    const workspace = currentWorkspace(request);
    const changed = scheduleTasks(db, workspace, parse(scheduleTasksSchema, request.body));
    return { tasks: getTasksByIds(db, workspace.id, changed) };
  });

  app.delete('/tasks/:id', async (request, reply) => {
    const { id } = parse(idParams, request.params);
    removeTask(db, currentWorkspace(request), id);
    reply.status(204);
  });

  app.get('/dependencies', async (request) => {
    const { projectId } = parse(dependencyQuery, request.query);
    return listDependencies(db, currentWorkspace(request).id, projectId);
  });

  app.post('/dependencies', async (request, reply) => {
    const dependency = createDependency(db, currentWorkspace(request), parse(createDependencySchema, request.body));
    reply.status(201);
    return dependency;
  });

  app.patch('/dependencies/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    return changeDependency(db, currentWorkspace(request), id, parse(updateDependencySchema, request.body));
  });

  app.delete('/dependencies/:id', async (request, reply) => {
    const { id } = parse(idParams, request.params);
    removeDependency(db, currentWorkspace(request), id);
    reply.status(204);
  });
}
