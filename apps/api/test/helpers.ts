import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { SessionResponse } from '@ott/shared';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { openDatabase, type Db } from '../src/db/database';

export interface TestContext {
  app: FastifyInstance;
  db: Db;
}

export async function createTestApp(): Promise<TestContext> {
  const db = openDatabase(':memory:');
  const config = { ...loadConfig({}), webDistPath: null };
  const app = await buildApp({ db, config });
  return { app, db };
}

export interface Session {
  cookie: string;
  session: SessionResponse;
  workspaceId: number;
  userId: number;
}

export function cookieFrom(response: LightMyRequestResponse): string {
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? header[0] : header;
  return (value ?? '').split(';')[0]!;
}

export async function signup(app: FastifyInstance, email = 'ana@exemplo.com', name = 'Ana'): Promise<Session> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { name, email, password: 'senha-segura', timezone: 'America/Sao_Paulo' },
  });
  if (response.statusCode !== 201) throw new Error(`signup falhou: ${response.body}`);
  const session = response.json<SessionResponse>();
  return {
    cookie: cookieFrom(response),
    session,
    workspaceId: session.workspaces[0]!.id,
    userId: session.user.id,
  };
}

/** Atalho para chamadas autenticadas em /api/workspaces/:id. */
export function client(app: FastifyInstance, session: Session) {
  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, payload?: unknown) =>
    app.inject({
      method,
      url: path.startsWith('/api') ? path : `/api/workspaces/${session.workspaceId}${path}`,
      headers: { cookie: session.cookie },
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
  return {
    get: (path: string) => call('GET', path),
    post: (path: string, payload: unknown = {}) => call('POST', path, payload),
    patch: (path: string, payload: unknown) => call('PATCH', path, payload),
    delete: (path: string) => call('DELETE', path),
  };
}
