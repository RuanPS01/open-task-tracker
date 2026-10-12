import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Task, TaskDependency } from '@ott/shared';
import { client, createTestApp, signup, type Session, type TestContext } from './helpers';

let ctx: TestContext;
let ana: Session;
let api: ReturnType<typeof client>;
let projectId: number;

beforeEach(async () => {
  ctx = await createTestApp();
  ana = await signup(ctx.app);
  api = client(ctx.app, ana);
  projectId = (await api.post('/projects', { name: 'Site', color: '#0b83d9' })).json().id;
});
afterEach(async () => {
  await ctx.app.close();
  ctx.db.close();
});

const createTask = async (payload: Record<string, unknown>): Promise<Task> => {
  const response = await api.post('/tasks', { projectId, ...payload });
  if (response.statusCode !== 201) throw new Error(response.body);
  return response.json<Task>();
};
const getTask = async (id: number) => (await api.get(`/tasks/${id}`)).json<Task>();

describe('tarefas', () => {
  it('cria com responsáveis e tags e lista por projeto', async () => {
    const tag = (await api.post('/tags', { name: 'Front' })).json();
    const task = await createTask({ name: 'Layout', assigneeIds: [ana.userId], tagIds: [tag.id], priority: 3 });
    expect(task).toMatchObject({ name: 'Layout', status: 'todo', priority: 3, assigneeIds: [ana.userId], tagIds: [tag.id] });
    const list = (await api.get(`/tasks?projectId=${projectId}`)).json<Task[]>();
    expect(list.map((t) => t.id)).toEqual([task.id]);
  });

  it('recusa responsável que não é membro', async () => {
    const response = await api.post('/tasks', { name: 'X', assigneeIds: [999] });
    expect(response.json().error.code).toBe('INVALID_ASSIGNEE');
  });

  it('normaliza datas: só início vira um dia, marco tem início igual ao fim', async () => {
    const single = await createTask({ name: 'Reunião', startDate: '2026-10-14' });
    expect(single).toMatchObject({ startDate: '2026-10-14', dueDate: '2026-10-14' });
    const milestone = await createTask({ name: 'Entrega', dueDate: '2026-10-30', isMilestone: true });
    expect(milestone).toMatchObject({ startDate: '2026-10-30', dueDate: '2026-10-30' });
    const invalid = await api.post('/tasks', { name: 'X', startDate: '2026-10-20', dueDate: '2026-10-10' });
    expect(invalid.json().error.code).toBe('INVALID_DATES');
  });

  it('concluir marca 100% e reabrir zera o progresso', async () => {
    const task = await createTask({ name: 'Revisar', progress: 40 });
    const done = (await api.patch(`/tasks/${task.id}`, { status: 'done' })).json<Task>();
    expect(done.progress).toBe(100);
    expect(done.completedAt).not.toBeNull();
    const reopened = (await api.patch(`/tasks/${task.id}`, { status: 'todo' })).json<Task>();
    expect(reopened).toMatchObject({ progress: 0, completedAt: null });
  });

  it('subtarefa herda o projeto e a mãe acompanha as datas das filhas', async () => {
    const parent = await createTask({ name: 'Fase 1' });
    await createTask({ name: 'A', parentId: parent.id, projectId: null, startDate: '2026-10-12', dueDate: '2026-10-14', progress: 100 });
    const b = await createTask({ name: 'B', parentId: parent.id, startDate: '2026-10-15', dueDate: '2026-10-16' });
    expect(b.projectId).toBe(projectId);
    const summary = await getTask(parent.id);
    expect(summary).toMatchObject({ startDate: '2026-10-12', dueDate: '2026-10-16' });
    expect(summary.progress).toBe(60);
  });

  it('impede que uma tarefa vire filha de uma descendente', async () => {
    const parent = await createTask({ name: 'Mãe' });
    const child = await createTask({ name: 'Filha', parentId: parent.id });
    const response = await api.patch(`/tasks/${parent.id}`, { parentId: child.id });
    expect(response.json().error.code).toBe('INVALID_PARENT');
  });

  it('excluir projeto remove as tarefas', async () => {
    const task = await createTask({ name: 'Some' });
    expect((await api.delete(`/projects/${projectId}`)).statusCode).toBe(204);
    expect((await api.get(`/tasks/${task.id}`)).statusCode).toBe(404);
  });
});

describe('dependências e cascata', () => {
  it('cria dependência e empurra a sucessora', async () => {
    const a = await createTask({ name: 'A', startDate: '2026-10-12', dueDate: '2026-10-16' });
    const b = await createTask({ name: 'B', startDate: '2026-10-14', dueDate: '2026-10-15' });
    const dep = await api.post('/dependencies', { predecessorId: a.id, successorId: b.id });
    expect(dep.statusCode).toBe(201);
    expect(dep.json<TaskDependency>()).toMatchObject({ type: 'FS', lagDays: 0 });
    expect(await getTask(b.id)).toMatchObject({ startDate: '2026-10-19', dueDate: '2026-10-20' });
  });

  it('mover a predecessora pelo lote do Gantt devolve a cascata', async () => {
    const a = await createTask({ name: 'A', startDate: '2026-10-12', dueDate: '2026-10-13' });
    const b = await createTask({ name: 'B', startDate: '2026-10-14', dueDate: '2026-10-14' });
    const c = await createTask({ name: 'C', startDate: '2026-10-15', dueDate: '2026-10-15' });
    await api.post('/dependencies', { predecessorId: a.id, successorId: b.id });
    await api.post('/dependencies', { predecessorId: b.id, successorId: c.id });
    const response = await api.post('/tasks/schedule', { updates: [{ id: a.id, startDate: '2026-10-14', dueDate: '2026-10-15' }] });
    const changed = response.json<{ tasks: Task[] }>().tasks;
    expect(changed.map((t) => t.id).sort()).toEqual([a.id, b.id, c.id].sort());
    expect(await getTask(c.id)).toMatchObject({ startDate: '2026-10-19', dueDate: '2026-10-19' });
  });

  it('respeita agendamento automático desligado', async () => {
    await api.patch('', { autoSchedule: false });
    const a = await createTask({ name: 'A', startDate: '2026-10-12', dueDate: '2026-10-16' });
    const b = await createTask({ name: 'B', startDate: '2026-10-13', dueDate: '2026-10-13' });
    await api.post('/dependencies', { predecessorId: a.id, successorId: b.id });
    expect(await getTask(b.id)).toMatchObject({ startDate: '2026-10-13' });
  });

  it('recusa ciclo, duplicata e ligação com a mãe', async () => {
    const a = await createTask({ name: 'A' });
    const b = await createTask({ name: 'B' });
    const child = await createTask({ name: 'Filha', parentId: a.id });
    await api.post('/dependencies', { predecessorId: a.id, successorId: b.id });
    expect((await api.post('/dependencies', { predecessorId: b.id, successorId: a.id })).json().error.code).toBe('DEPENDENCY_DUPLICATE');
    expect((await api.post('/dependencies', { predecessorId: a.id, successorId: child.id })).json().error.code).toBe('DEPENDENCY_HIERARCHY');
    expect((await api.post('/dependencies', { predecessorId: b.id, successorId: child.id })).json().error.code).toBe('DEPENDENCY_CYCLE');
  });

  it('lista dependências do projeto e permite alterar e remover', async () => {
    const a = await createTask({ name: 'A', startDate: '2026-10-12', dueDate: '2026-10-12' });
    const b = await createTask({ name: 'B', startDate: '2026-10-13', dueDate: '2026-10-13' });
    const dep = (await api.post('/dependencies', { predecessorId: a.id, successorId: b.id })).json<TaskDependency>();
    const updated = (await api.patch(`/dependencies/${dep.id}`, { lagDays: 2 })).json<TaskDependency>();
    expect(updated.lagDays).toBe(2);
    expect(await getTask(b.id)).toMatchObject({ startDate: '2026-10-15' });
    expect((await api.get(`/dependencies?projectId=${projectId}`)).json()).toHaveLength(1);
    expect((await api.delete(`/dependencies/${dep.id}`)).statusCode).toBe(204);
    expect((await api.get('/dependencies')).json()).toHaveLength(0);
  });
});
