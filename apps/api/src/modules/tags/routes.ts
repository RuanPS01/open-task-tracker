import { createTagSchema, updateTagSchema } from '@ott/shared';
import type { FastifyInstance } from 'fastify';
import { conflict, notFound } from '../../http/errors';
import { currentWorkspace, idParams } from '../../http/context';
import { parse } from '../../http/validation';
import { deleteTag, findTagByName, getTag, insertTag, listTags, renameTag } from './repo';

export async function tagRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app;

  app.get('/tags', async (request) => listTags(db, currentWorkspace(request).id));

  app.post('/tags', async (request, reply) => {
    const workspace = currentWorkspace(request);
    const { name } = parse(createTagSchema, request.body);
    if (findTagByName(db, workspace.id, name)) throw conflict('NAME_TAKEN', 'Já existe uma tag com esse nome');
    reply.status(201);
    return getTag(db, workspace.id, insertTag(db, workspace.id, name));
  });

  app.patch('/tags/:id', async (request) => {
    const workspace = currentWorkspace(request);
    const { id } = parse(idParams, request.params);
    const { name } = parse(updateTagSchema, request.body);
    if (!getTag(db, workspace.id, id)) throw notFound('Tag');
    const other = findTagByName(db, workspace.id, name);
    if (other && other.id !== id) throw conflict('NAME_TAKEN', 'Já existe uma tag com esse nome');
    renameTag(db, workspace.id, id, name);
    return getTag(db, workspace.id, id);
  });

  app.delete('/tags/:id', async (request, reply) => {
    const workspace = currentWorkspace(request);
    const { id } = parse(idParams, request.params);
    if (!getTag(db, workspace.id, id)) throw notFound('Tag');
    deleteTag(db, workspace.id, id);
    reply.status(204);
  });
}
