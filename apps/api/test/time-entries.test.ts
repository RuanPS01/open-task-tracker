import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReportSummary, TimeEntry } from '@ott/shared';
import { client, createTestApp, signup, type Session, type TestContext } from './helpers';

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

describe('cronômetro', () => {
  it('inicia, mostra como atual e para', async () => {
    const started = await api.post('/time-entries/start', { description: 'Escrevendo' });
    expect(started.statusCode).toBe(201);
    const entry = started.json<TimeEntry>();
    expect(entry.stop).toBeNull();

    const current = (await api.get('/api/me/timer')).json<{ entry: TimeEntry | null }>();
    expect(current.entry?.id).toBe(entry.id);

    const stopped = (await api.post(`/time-entries/${entry.id}/stop`)).json<TimeEntry>();
    expect(stopped.stop).not.toBeNull();
    expect((await api.get('/api/me/timer')).json().entry).toBeNull();
  });

  it('iniciar outro cronômetro para o anterior', async () => {
    const first = (await api.post('/time-entries/start', { description: 'Um' })).json<TimeEntry>();
    await api.post('/time-entries/start', { description: 'Dois' });
    const running = ctx.db.all<{ id: number }>('SELECT id FROM time_entries WHERE stop IS NULL');
    expect(running).toHaveLength(1);
    expect(running[0]!.id).not.toBe(first.id);
  });

  it('apontamento de tarefa herda projeto e faturável', async () => {
    const project = (await api.post('/projects', { name: 'Cliente', color: '#d94182', billable: true })).json();
    const task = (await api.post('/tasks', { name: 'Tela', projectId: project.id })).json();
    const entry = (await api.post('/time-entries/start', { taskId: task.id })).json<TimeEntry>();
    expect(entry).toMatchObject({ projectId: project.id, taskId: task.id, billable: true });
  });
});

describe('apontamentos manuais', () => {
  it('cria, lista por intervalo, edita e exclui', async () => {
    const created = await api.post('/time-entries', {
      description: 'Reunião',
      start: '2026-10-12T12:00:00.000Z',
      stop: '2026-10-12T13:30:00.000Z',
    });
    expect(created.statusCode).toBe(201);
    const entry = created.json<TimeEntry>();
    expect(entry.duration).toBe(5400);

    const list = (await api.get('/time-entries?from=2026-10-12T00:00:00.000Z&to=2026-10-13T00:00:00.000Z')).json<TimeEntry[]>();
    expect(list).toHaveLength(1);
    const outside = (await api.get('/time-entries?from=2026-10-13T00:00:00.000Z&to=2026-10-14T00:00:00.000Z')).json();
    expect(outside).toHaveLength(0);

    const edited = (await api.patch(`/time-entries/${entry.id}`, { stop: '2026-10-12T14:00:00-03:00' })).json<TimeEntry>();
    expect(edited.stop).toBe('2026-10-12T17:00:00.000Z');
    expect((await api.delete(`/time-entries/${entry.id}`)).statusCode).toBe(204);
  });

  it('recusa fim antes do início', async () => {
    const response = await api.post('/time-entries', {
      start: '2026-10-12T12:00:00.000Z',
      stop: '2026-10-12T11:00:00.000Z',
    });
    expect(response.json().error.code).toBe('INVALID_RANGE');
  });

  it('não deixa editar apontamento de outra pessoa', async () => {
    const entry = (await api.post('/time-entries', { start: '2026-10-12T12:00:00Z', stop: '2026-10-12T13:00:00Z' })).json();
    const added = (await api.post('/members', { name: 'Bia', email: 'bia@exemplo.com' })).json();
    const login = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'bia@exemplo.com', password: added.temporaryPassword } });
    const bia = { ...ana, cookie: login.headers['set-cookie']!.toString().split(';')[0]! };
    const response = await client(ctx.app, bia).patch(`/time-entries/${entry.id}`, { description: 'x' });
    expect(response.statusCode).toBe(403);
  });
});

describe('relatórios', () => {
  it('agrupa por dia local, projeto e calcula valor faturável', async () => {
    await api.patch('', { defaultHourlyRate: 100 });
    const project = (await api.post('/projects', { name: 'Site', color: '#0b83d9', billable: true, hourlyRate: 150 })).json();
    // 02:00Z do dia 13 ainda é dia 12 em São Paulo (UTC-3).
    await api.post('/time-entries', { projectId: project.id, description: 'Layout', start: '2026-10-13T01:00:00Z', stop: '2026-10-13T02:00:00Z' });
    await api.post('/time-entries', { projectId: project.id, description: 'Layout', start: '2026-10-13T15:00:00Z', stop: '2026-10-13T15:30:00Z' });
    await api.post('/time-entries', { description: 'Sem projeto', billable: true, start: '2026-10-14T15:00:00Z', stop: '2026-10-14T16:00:00Z' });

    const summary = (await api.get('/reports/summary?start=2026-10-12&end=2026-10-18&tz=America/Sao_Paulo')).json<ReportSummary>();
    expect(summary.totalSeconds).toBe(9000);
    expect(summary.byDay.find((d) => d.date === '2026-10-12')!.seconds).toBe(3600);
    expect(summary.byDay.find((d) => d.date === '2026-10-13')!.seconds).toBe(1800);
    expect(summary.byDay).toHaveLength(7);
    const site = summary.byProject.find((p) => p.projectId === project.id)!;
    expect(site.amount).toBe(225);
    expect(site.items).toEqual([{ description: 'Layout', taskId: null, seconds: 5400 }]);
    expect(summary.amount).toBe(325);

    const onlyNoProject = (await api.get('/reports/summary?start=2026-10-12&end=2026-10-18&tz=America/Sao_Paulo&projectIds=0')).json<ReportSummary>();
    expect(onlyNoProject.totalSeconds).toBe(3600);
  });

  it('exporta CSV com separador brasileiro e recusa fuso inválido', async () => {
    await api.post('/time-entries', { description: '=SOMA(A1)', start: '2026-10-13T15:00:00Z', stop: '2026-10-13T16:00:00Z' });
    const csv = await api.get('/reports/detailed.csv?start=2026-10-12&end=2026-10-18&tz=America/Sao_Paulo');
    expect(csv.headers['content-type']).toContain('text/csv');
    const lines = csv.body.trim().split('\r\n');
    expect(lines[0]).toContain('Usuário;E-mail;Cliente');
    expect(lines[1]).toContain("'=SOMA(A1)");
    expect(lines[1]).toContain('2026-10-13;12:00:00');

    const bad = await api.get('/reports/summary?start=2026-10-12&end=2026-10-18&tz=Lua/Base');
    expect(bad.json().error.code).toBe('INVALID_TIMEZONE');
  });
});
