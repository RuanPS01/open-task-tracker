// Feriados do workspace. Entram no calendário de trabalho como dias não úteis
// (Gantt, cascata, caminho crítico e capacidade). Só administradores alteram.
import { brazilianHolidays, createHolidaySchema, importHolidaysSchema } from '@ott/shared';
import type { FastifyInstance } from 'fastify';
import { conflict, notFound } from '../../http/errors';
import { currentWorkspace, idParams, requireAdmin } from '../../http/context';
import { parse } from '../../http/validation';
import { applyScheduling } from '../tasks/service';
import { deleteHoliday, getHoliday, insertHoliday, listHolidays } from './repo';

export async function holidayRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app;

  app.get('/holidays', async (request) => listHolidays(db, currentWorkspace(request).id));

  app.post('/holidays', async (request, reply) => {
    const workspace = requireAdmin(request);
    const input = parse(createHolidaySchema, request.body);
    db.transaction(() => {
      if (!insertHoliday(db, workspace.id, input.date, input.name)) {
        throw conflict('DATE_TAKEN', 'Já existe um feriado nesta data');
      }
      applyScheduling(db, workspace);
    });
    reply.status(201);
    return listHolidays(db, workspace.id).find((holiday) => holiday.date === input.date);
  });

  /** Importa os feriados nacionais do Brasil de um ano; datas já cadastradas ficam como estão. */
  app.post('/holidays/import', async (request) => {
    const workspace = requireAdmin(request);
    const input = parse(importHolidaysSchema, request.body);
    const created = db.transaction(() => {
      let count = 0;
      for (const holiday of brazilianHolidays(input.year, input.includeOptional)) {
        if (insertHoliday(db, workspace.id, holiday.date, holiday.name)) count += 1;
      }
      applyScheduling(db, workspace);
      return count;
    });
    return { created, holidays: listHolidays(db, workspace.id) };
  });

  app.delete('/holidays/:id', async (request, reply) => {
    const workspace = requireAdmin(request);
    const { id } = parse(idParams, request.params);
    if (!getHoliday(db, workspace.id, id)) throw notFound('Feriado');
    deleteHoliday(db, workspace.id, id);
    reply.status(204);
  });
}
