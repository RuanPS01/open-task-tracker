import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SessionResponse } from '@ott/shared';
import { client, cookieFrom, createTestApp, signup, type TestContext } from './helpers';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestApp();
});
afterEach(async () => {
  await ctx.app.close();
  ctx.db.close();
});

describe('autenticação', () => {
  it('cadastra, cria o workspace padrão e abre sessão', async () => {
    const { session, cookie } = await signup(ctx.app);
    expect(session.user.name).toBe('Ana');
    expect(session.workspaces).toHaveLength(1);
    expect(session.workspaces[0]!.name).toBe('Workspace de Ana');
    expect(session.workspaces[0]!.role).toBe('admin');
    expect(session.user.currentWorkspaceId).toBe(session.workspaces[0]!.id);
    expect(session.user.preferences.timezone).toBe('America/Sao_Paulo');
    expect(cookie).toMatch(/^ott_session=/);
  });

  it('não guarda a senha em texto puro', async () => {
    await signup(ctx.app);
    const row = ctx.db.get<{ password_hash: string }>('SELECT password_hash FROM users');
    expect(row!.password_hash).toMatch(/^scrypt\$/);
    expect(row!.password_hash).not.toContain('senha-segura');
  });

  it('recusa e-mail repetido', async () => {
    await signup(ctx.app);
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: { name: 'Outra', email: 'ANA@exemplo.com', password: 'senha-segura' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('EMAIL_TAKEN');
  });

  it('faz login e logout', async () => {
    await signup(ctx.app);
    const wrong = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ana@exemplo.com', password: 'errada' },
    });
    expect(wrong.statusCode).toBe(401);

    const login = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ana@exemplo.com', password: 'senha-segura' },
    });
    expect(login.statusCode).toBe(200);
    const cookie = cookieFrom(login);

    const me = await ctx.app.inject({ method: 'GET', url: '/api/auth/session', headers: { cookie } });
    expect(me.json<SessionResponse>().user.email).toBe('ana@exemplo.com');

    await ctx.app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    const after = await ctx.app.inject({ method: 'GET', url: '/api/auth/session', headers: { cookie } });
    expect(after.statusCode).toBe(401);
  });

  it('bloqueia rotas sem sessão', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/workspaces/1/projects' });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('recusa corpo text/plain (proteção contra CSRF por formulário)', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'text/plain' },
      payload: 'email=ana@exemplo.com',
    });
    expect(response.statusCode).toBe(415);
  });

  it('atualiza preferências e troca senha', async () => {
    const ana = await signup(ctx.app);
    const api = client(ctx.app, ana);
    const updated = await api.patch('/api/me', { preferences: { theme: 'light', locale: 'en' } });
    expect(updated.json<SessionResponse>().user.preferences).toMatchObject({ theme: 'light', locale: 'en', weekStart: 1 });

    const bad = await api.post('/api/me/password', { currentPassword: 'x', newPassword: 'nova-senha-1' });
    expect(bad.json().error.code).toBe('WRONG_PASSWORD');
    const ok = await api.post('/api/me/password', { currentPassword: 'senha-segura', newPassword: 'nova-senha-1' });
    expect(ok.statusCode).toBe(200);
  });
});

describe('workspaces e membros', () => {
  it('isola os dados entre workspaces', async () => {
    const ana = await signup(ctx.app);
    const bruno = await signup(ctx.app, 'bruno@exemplo.com', 'Bruno');
    const created = await client(ctx.app, ana).post('/projects', { name: 'Secreto', color: '#0b83d9' });
    expect(created.statusCode).toBe(201);

    const intruder = await ctx.app.inject({
      method: 'GET',
      url: `/api/workspaces/${ana.workspaceId}/projects`,
      headers: { cookie: bruno.cookie },
    });
    expect(intruder.statusCode).toBe(404);
  });

  it('admin adiciona membro com senha temporária e o membro consegue entrar', async () => {
    const ana = await signup(ctx.app);
    const api = client(ctx.app, ana);
    const added = await api.post('/members', { name: 'Carla', email: 'carla@exemplo.com', weeklyCapacityHours: 30 });
    expect(added.statusCode).toBe(201);
    const body = added.json();
    expect(body.member).toMatchObject({ name: 'Carla', role: 'member', weeklyCapacityHours: 30 });
    expect(body.temporaryPassword).toEqual(expect.any(String));

    const login = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'carla@exemplo.com', password: body.temporaryPassword },
    });
    expect(login.json<SessionResponse>().workspaces[0]!.id).toBe(ana.workspaceId);

    // Membro comum não administra membros.
    const carla = { cookie: cookieFrom(login), workspaceId: ana.workspaceId } as typeof ana;
    const denied = await client(ctx.app, carla).post('/members', { name: 'X', email: 'x@exemplo.com' });
    expect(denied.statusCode).toBe(403);
  });

  it('não deixa o workspace sem administrador', async () => {
    const ana = await signup(ctx.app);
    const response = await client(ctx.app, ana).patch(`/members/${ana.userId}`, { role: 'member' });
    expect(response.json().error.code).toBe('LAST_ADMIN');
  });

  it('atualiza dias úteis e agendamento automático', async () => {
    const ana = await signup(ctx.app);
    const response = await client(ctx.app, ana).patch('', { workingDays: [5, 1, 2, 3, 4, 6], autoSchedule: false });
    expect(response.json()).toMatchObject({ workingDays: [1, 2, 3, 4, 5, 6], autoSchedule: false });
  });
});
