import { addMemberSchema, DEFAULT_WEEKLY_CAPACITY_HOURS, updateMemberSchema, type AddMemberResponse } from '@ott/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, conflict, notFound } from '../../http/errors';
import { currentUser, currentWorkspace, requireAdmin } from '../../http/context';
import { parse } from '../../http/validation';
import { generateTemporaryPassword, hashPassword } from '../auth/password';
import { findUserByEmail, insertUser, setCurrentWorkspace } from '../users/repo';
import { countActiveAdmins, deleteMember, getMember, insertMember, listMembers, updateMember } from './repo';

const userParams = z.object({ userId: z.coerce.number().int().positive() });

export async function memberRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app;

  app.get('/members', async (request) => listMembers(db, currentWorkspace(request).id));

  /**
   * Adiciona uma pessoa. Se o e-mail ainda não tem conta, cria a conta com senha
   * temporária e devolve a senha uma única vez para o admin repassar (instalação
   * própria, sem servidor de e-mail).
   */
  app.post('/members', async (request, reply): Promise<AddMemberResponse> => {
    const workspace = requireAdmin(request);
    const input = parse(addMemberSchema, request.body);
    let temporaryPassword: string | null = null;
    let user = findUserByEmail(db, input.email);
    if (user && getMember(db, workspace.id, user.id)) {
      throw conflict('ALREADY_MEMBER', 'Esta pessoa já é membro do workspace');
    }
    if (!user) {
      temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      user = insertUser(db, { name: input.name, email: input.email, passwordHash });
      setCurrentWorkspace(db, user.id, workspace.id);
    }
    insertMember(db, {
      workspaceId: workspace.id,
      userId: user.id,
      role: input.role ?? 'member',
      weeklyCapacityHours: input.weeklyCapacityHours ?? DEFAULT_WEEKLY_CAPACITY_HOURS,
      hourlyRate: input.hourlyRate ?? null,
    });
    reply.status(201);
    return { member: getMember(db, workspace.id, user.id)!, temporaryPassword };
  });

  app.patch('/members/:userId', async (request) => {
    const workspace = requireAdmin(request);
    const { userId } = parse(userParams, request.params);
    const input = parse(updateMemberSchema, request.body);
    const member = getMember(db, workspace.id, userId);
    if (!member) throw notFound('Membro');
    const losesAdmin =
      member.role === 'admin' && member.active && (input.role === 'member' || input.active === false);
    if (losesAdmin && countActiveAdmins(db, workspace.id) <= 1) {
      throw badRequest('LAST_ADMIN', 'O workspace precisa de pelo menos um administrador ativo');
    }
    updateMember(db, workspace.id, userId, input);
    return getMember(db, workspace.id, userId);
  });

  app.delete('/members/:userId', async (request, reply) => {
    const workspace = requireAdmin(request);
    const { userId } = parse(userParams, request.params);
    const member = getMember(db, workspace.id, userId);
    if (!member) throw notFound('Membro');
    if (member.role === 'admin' && countActiveAdmins(db, workspace.id) <= 1) {
      throw badRequest('LAST_ADMIN', 'O workspace precisa de pelo menos um administrador ativo');
    }
    if (userId === currentUser(request).id) {
      throw badRequest('REMOVE_SELF', 'Peça a outro administrador para remover você');
    }
    deleteMember(db, workspace.id, userId);
    reply.status(204);
  });
}
