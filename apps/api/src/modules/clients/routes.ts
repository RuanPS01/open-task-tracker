import { createClientSchema, updateClientSchema } from '@ott/shared';
import type { FastifyInstance } from 'fastify';
import { conflict, notFound } from '../../http/errors';
import { currentWorkspace, idParams } from '../../http/context';
import { parse } from '../../http/validation';
import { deleteClient, findClientByName, getClient, insertClient, listClients, updateClient } from './repo';

export async function clientRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app;

  app.get('/clients', async (request) => listClients(db, currentWorkspace(request).id));

  app.post('/clients', async (request, reply) => {
    const workspace = currentWorkspace(request);
    const input = parse(createClientSchema, request.body);
    if (findClientByName(db, workspace.id, input.name)) throw conflict('NAME_TAKEN', 'Já existe um cliente com esse nome');
    reply.status(201);
    return getClient(db, workspace.id, insertClient(db, workspace.id, input));
  });

  app.patch('/clients/:id', async (request) => {
    const workspace = currentWorkspace(request);
    const { id } = parse(idParams, request.params);
    const input = parse(updateClientSchema, request.body);
    if (!getClient(db, workspace.id, id)) throw notFound('Cliente');
    const other = input.name ? findClientByName(db, workspace.id, input.name) : null;
    if (other && other.id !== id) throw conflict('NAME_TAKEN', 'Já existe um cliente com esse nome');
    updateClient(db, workspace.id, id, input);
    return getClient(db, workspace.id, id);
  });

  app.delete('/clients/:id', async (request, reply) => {
    const workspace = currentWorkspace(request);
    const { id } = parse(idParams, request.params);
    if (!getClient(db, workspace.id, id)) throw notFound('Cliente');
    deleteClient(db, workspace.id, id);
    reply.status(204);
  });
}
