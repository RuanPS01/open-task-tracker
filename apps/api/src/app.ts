// Raiz de composição da API: registra plugins, sessão, tratamento de erro e rotas.
// Os testes chamam buildApp com banco em memória e usam app.inject, sem abrir porta.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import type { ApiErrorBody } from '@ott/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config';
import type { Db } from './db/database';
import { requireWorkspace } from './http/context';
import { AppError } from './http/errors';
import { authRoutes } from './modules/auth/routes';
import { findSessionUserId, SESSION_COOKIE } from './modules/auth/sessions';
import { clientRoutes } from './modules/clients/routes';
import { holidayRoutes } from './modules/holidays/routes';
import { memberRoutes } from './modules/members/routes';
import { projectRoutes } from './modules/projects/routes';
import { reportRoutes } from './modules/reports/routes';
import { tagRoutes } from './modules/tags/routes';
import { taskRoutes } from './modules/tasks/routes';
import { timeEntryRoutes } from './modules/time-entries/routes';
import { findUserById, toUser } from './modules/users/repo';
import { workspaceCollectionRoutes, workspaceRoutes } from './modules/workspaces/routes';

export interface BuildAppOptions {
  db: Db;
  config: AppConfig;
  logger?: boolean;
}

const errorBody = (code: string, message: string, details?: unknown): ApiErrorBody => ({
  error: { code, message, ...(details === undefined ? {} : { details }) },
});

export async function buildApp({ db, config, logger = false }: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: logger ? { level: config.logLevel } : false,
    trustProxy: true,
    bodyLimit: 1_048_576,
  });

  app.decorate('db', db);
  app.decorate('config', config);
  app.decorateRequest('user', null);
  app.decorateRequest('sessionToken', null);
  app.decorateRequest('workspace', null);

  // Sem parser de text/plain: um formulário de outro site não consegue montar um
  // POST aceito pela API, o que fecha a porta mais comum de CSRF.
  app.removeContentTypeParser('text/plain');

  await app.register(fastifyCookie);

  app.addHook('onRequest', async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) return;
    const userId = findSessionUserId(db, token);
    const row = userId === null ? undefined : findUserById(db, userId);
    if (row) {
      request.user = toUser(row);
      request.sessionToken = token;
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(errorBody(error.code, error.message, error.details));
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      const code = (error as { code?: string }).code ?? 'BAD_REQUEST';
      return reply.status(status).send(errorBody(code, (error as Error).message));
    }
    request.log.error(error);
    return reply.status(500).send(errorBody('INTERNAL', 'Erro interno'));
  });

  app.get('/api/health', async () => ({ ok: true }));

  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(workspaceCollectionRoutes);
      await api.register(
        async (scoped) => {
          scoped.addHook('preHandler', requireWorkspace);
          await scoped.register(workspaceRoutes);
          await scoped.register(memberRoutes);
          await scoped.register(clientRoutes);
          await scoped.register(tagRoutes);
          await scoped.register(holidayRoutes);
          await scoped.register(projectRoutes);
          await scoped.register(taskRoutes);
          await scoped.register(timeEntryRoutes);
          await scoped.register(reportRoutes);
        },
        { prefix: '/workspaces/:workspaceId' },
      );
    },
    { prefix: '/api' },
  );

  // Em produção a API também entrega a web compilada (um processo, uma porta).
  const webDist = config.webDistPath;
  const servesWeb = webDist !== null && existsSync(join(webDist, 'index.html'));
  if (servesWeb) {
    await app.register(fastifyStatic, { root: webDist, wildcard: false });
  }
  app.setNotFoundHandler((request, reply) => {
    if (servesWeb && request.method === 'GET' && !request.url.startsWith('/api/')) {
      // Rotas do React Router (/timer, /projects/3...) caem no index.html.
      return reply.sendFile('index.html');
    }
    return reply.status(404).send(errorBody('NOT_FOUND', 'Rota não encontrada'));
  });

  return app;
}
