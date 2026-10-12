import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Holiday, Task } from '@ott/shared';
import { client, cookieFrom, createTestApp, signup, type Session, type TestContext } from './helpers';

let ctx: TestContext;
let ana: Session;
let api: ReturnType<typeof client>;

beforeEach(async () => {
  ctx = await createTestApp();
  ana = await signup(ctx.app);
  api = client(ctx.app, ana);
});
afterEach(async () => {
  await ctx.app.close();
  ctx.db.close();
});

describe('feriados', () => {
  it('cadastra, lista, recusa data repetida e exclui', async () => {
    const created = await api.post('/holidays', { date: '2026-10-12', name: 'Nossa Senhora Aparecida' });
    expect(created.statusCode).toBe(201);
    const holiday = created.json<Holiday>();
    expect(holiday).toMatchObject({ date: '2026-10-12', name: 'Nossa Senhora Aparecida' });
    expect((await api.post('/holidays', { date: '2026-10-12', name: 'Outro' })).json().error.code).toBe('DATE_TAKEN');
    expect((await api.get('/holidays')).json()).toHaveLength(1);
    expect((await api.delete(`/holidays/${holiday.id}`)).statusCode).toBe(204);
    expect((await api.get('/holidays')).json()).toHaveLength(0);
  });

  it('importa os feriados nacionais sem duplicar', async () => {
    const first = (await api.post('/holidays/import', { year: 2026 })).json<{ created: number; holidays: Holiday[] }>();
    expect(first.created).toBe(10);
    expect(first.holidays.map((h) => h.date)).toContain('2026-04-03');
    const again = (await api.post('/holidays/import', { year: 2026, includeOptional: true })).json<{ created: number }>();
    expect(again.created).toBe(3);
  });

  it('só administradores alteram feriados', async () => {
    const added = (await api.post('/members', { name: 'Bia', email: 'bia@exemplo.com' })).json();
    const login = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'bia@exemplo.com', password: added.temporaryPassword } });
    const bia = { ...ana, cookie: cookieFrom(login) };
    expect((await client(ctx.app, bia).post('/holidays', { date: '2026-12-24', name: 'Véspera' })).statusCode).toBe(403);
    expect((await client(ctx.app, bia).get('/holidays')).statusCode).toBe(200);
  });

  it('a cascata pula o feriado, mas a tarefa liberada pode cair nele', async () => {
    await api.post('/holidays', { date: '2026-10-19', name: 'Feriado local' });
    const project = (await api.post('/projects', { name: 'P', color: '#0b83d9' })).json();
    const mk = async (payload: Record<string, unknown>) => (await api.post('/tasks', { projectId: project.id, ...payload })).json<Task>();
    const a = await mk({ name: 'A', startDate: '2026-10-14', dueDate: '2026-10-16' });
    const normal = await mk({ name: 'Normal', startDate: '2026-10-15', dueDate: '2026-10-15' });
    const weekend = await mk({ name: 'Plantão', startDate: '2026-10-15', dueDate: '2026-10-15', allowNonWorkingDays: true });
    expect(weekend.allowNonWorkingDays).toBe(true);
    await api.post('/dependencies', { predecessorId: a.id, successorId: normal.id });
    await api.post('/dependencies', { predecessorId: a.id, successorId: weekend.id });
    const get = async (id: number) => (await api.get(`/tasks/${id}`)).json<Task>();
    expect((await get(normal.id)).startDate).toBe('2026-10-20');
    expect((await get(weekend.id)).startDate).toBe('2026-10-17');
  });
});
