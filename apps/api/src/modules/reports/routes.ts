import { reportQuerySchema } from '@ott/shared';
import type { FastifyInstance } from 'fastify';
import { currentUser, currentWorkspace } from '../../http/context';
import { parse } from '../../http/validation';
import { buildDetailedCsv } from './csv';
import { buildDetailed, buildSummary } from './service';

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app;

  app.get('/reports/summary', async (request) => {
    return buildSummary(db, currentWorkspace(request), parse(reportQuerySchema, request.query));
  });

  app.get('/reports/detailed', async (request) => {
    return buildDetailed(db, currentWorkspace(request), parse(reportQuerySchema, request.query));
  });

  app.get('/reports/detailed.csv', async (request, reply) => {
    const query = parse(reportQuerySchema, request.query);
    const locale = currentUser(request).preferences.locale;
    const csv = buildDetailedCsv(db, currentWorkspace(request), query, locale);
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="relatorio-${query.start}-a-${query.end}.csv"`);
    return csv;
  });
}
