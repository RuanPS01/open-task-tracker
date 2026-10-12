import {
  createTimeEntrySchema,
  startTimerSchema,
  timeEntriesQuerySchema,
  updateTimeEntrySchema,
} from '@ott/shared';
import type { FastifyInstance } from 'fastify';
import { currentUser, currentWorkspace, idParams } from '../../http/context';
import { parse } from '../../http/validation';
import { listTimeEntries } from './repo';
import {
  createTimeEntry,
  removeTimeEntry,
  startTimer,
  stopTimeEntry,
  updateTimeEntry,
} from './service';

export async function timeEntryRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app;

  app.get('/time-entries', async (request) => {
    const query = parse(timeEntriesQuerySchema, request.query);
    const user = currentUser(request);
    // Apontamentos de outra pessoa só aparecem nos relatórios; aqui é sempre o próprio.
    return listTimeEntries(
      db,
      currentWorkspace(request).id,
      user.id,
      new Date(query.from).toISOString(),
      new Date(query.to).toISOString(),
    );
  });

  app.post('/time-entries', async (request, reply) => {
    const entry = createTimeEntry(db, currentWorkspace(request), currentUser(request).id, parse(createTimeEntrySchema, request.body));
    reply.status(201);
    return entry;
  });

  app.post('/time-entries/start', async (request, reply) => {
    const entry = startTimer(db, currentWorkspace(request), currentUser(request).id, parse(startTimerSchema, request.body ?? {}));
    reply.status(201);
    return entry;
  });

  app.patch('/time-entries/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    return updateTimeEntry(db, currentWorkspace(request), currentUser(request).id, id, parse(updateTimeEntrySchema, request.body));
  });

  app.post('/time-entries/:id/stop', async (request) => {
    const { id } = parse(idParams, request.params);
    return stopTimeEntry(db, currentWorkspace(request), currentUser(request).id, id);
  });

  app.delete('/time-entries/:id', async (request, reply) => {
    const { id } = parse(idParams, request.params);
    removeTimeEntry(db, currentWorkspace(request), currentUser(request).id, id);
    reply.status(204);
  });
}
