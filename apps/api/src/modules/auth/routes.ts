import {
  changePasswordSchema,
  loginSchema,
  signupSchema,
  switchWorkspaceSchema,
  updateProfileSchema,
  type SessionResponse,
} from '@ott/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { badRequest, conflict, notFound, unauthorized } from '../../http/errors';
import { currentUser, requireAuth } from '../../http/context';
import { parse } from '../../http/validation';
import { getRunningEntry } from '../time-entries/repo';
import {
  findUserByEmail,
  findUserById,
  insertUser,
  setCurrentWorkspace,
  toUser,
  updateUser,
} from '../users/repo';
import { getWorkspaceForUser, insertWorkspace, listWorkspacesForUser } from '../workspaces/repo';
import { hashPassword, verifyPassword } from './password';
import { createSession, deleteOtherSessions, deleteSession, SESSION_COOKIE } from './sessions';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const { db, config } = app;

  const sessionResponse = (userId: number): SessionResponse => {
    const workspaces = listWorkspacesForUser(db, userId);
    let row = findUserById(db, userId)!;
    // Workspace atual removido ou desativado: cai no primeiro disponível.
    if (!workspaces.some((w) => w.id === row.current_workspace_id)) {
      setCurrentWorkspace(db, userId, workspaces[0]?.id ?? null);
      row = findUserById(db, userId)!;
    }
    return { user: toUser(row), workspaces };
  };

  const startSession = (reply: FastifyReply, userId: number) => {
    const { token, expiresAt } = createSession(db, userId, config.sessionDays);
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      expires: expiresAt,
    });
  };

  app.post('/auth/signup', async (request, reply) => {
    const input = parse(signupSchema, request.body);
    if (findUserByEmail(db, input.email)) throw conflict('EMAIL_TAKEN', 'E-mail já cadastrado');
    const passwordHash = await hashPassword(input.password);
    const userId = db.transaction(() => {
      const user = insertUser(db, {
        name: input.name,
        email: input.email,
        passwordHash,
        preferences: {
          ...(input.locale ? { locale: input.locale } : {}),
          ...(input.timezone ? { timezone: input.timezone } : {}),
        },
      });
      const workspaceName =
        input.workspaceName ?? (input.locale === 'en' ? `${input.name}'s workspace` : `Workspace de ${input.name}`);
      const workspaceId = insertWorkspace(db, workspaceName, user.id);
      setCurrentWorkspace(db, user.id, workspaceId);
      return user.id;
    });
    startSession(reply, userId);
    reply.status(201);
    return sessionResponse(userId);
  });

  app.post('/auth/login', async (request, reply) => {
    const input = parse(loginSchema, request.body);
    const row = findUserByEmail(db, input.email);
    // Mesma resposta para e-mail inexistente e senha errada: não revela quem tem conta.
    if (!row || !(await verifyPassword(input.password, row.password_hash))) {
      throw unauthorized('E-mail ou senha incorretos');
    }
    startSession(reply, row.id);
    return sessionResponse(row.id);
  });

  app.post('/auth/logout', async (request, reply) => {
    if (request.sessionToken) deleteSession(db, request.sessionToken);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/auth/session', { preHandler: requireAuth }, async (request) => {
    return sessionResponse(currentUser(request).id);
  });

  app.patch('/me', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const input = parse(updateProfileSchema, request.body);
    if (input.email && input.email !== user.email) {
      const other = findUserByEmail(db, input.email);
      if (other && other.id !== user.id) throw conflict('EMAIL_TAKEN', 'E-mail já cadastrado');
    }
    if (input.preferences?.timezone) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: input.preferences.timezone });
      } catch {
        throw badRequest('INVALID_TIMEZONE', 'Fuso horário inválido');
      }
    }
    updateUser(db, user.id, {
      name: input.name,
      email: input.email,
      preferences: input.preferences ? { ...user.preferences, ...input.preferences } : undefined,
    });
    return sessionResponse(user.id);
  });

  app.post('/me/password', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const input = parse(changePasswordSchema, request.body);
    const row = findUserById(db, user.id)!;
    if (!(await verifyPassword(input.currentPassword, row.password_hash))) {
      throw badRequest('WRONG_PASSWORD', 'Senha atual incorreta');
    }
    updateUser(db, user.id, { passwordHash: await hashPassword(input.newPassword) });
    // Troca de senha derruba as outras sessões abertas (outro navegador, outro aparelho).
    if (request.sessionToken) deleteOtherSessions(db, user.id, request.sessionToken);
    return { ok: true };
  });

  app.post('/me/workspace', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const { workspaceId } = parse(switchWorkspaceSchema, request.body);
    if (!getWorkspaceForUser(db, workspaceId, user.id)) throw notFound('Workspace');
    setCurrentWorkspace(db, user.id, workspaceId);
    return sessionResponse(user.id);
  });

  /** Cronômetro rodando da pessoa, em qualquer workspace (regra global do Toggl). */
  app.get('/me/timer', { preHandler: requireAuth }, async (request) => {
    return { entry: getRunningEntry(db, currentUser(request).id) };
  });
}
