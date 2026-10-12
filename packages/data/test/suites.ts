// Regras de negócio testadas pela fachada (as mesmas chamadas que a web faz).
// Registradas uma vez e executadas em cada ambiente (local e, se houver, Firebase).
import { NO_ID, type Task } from '@ott/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { expectCode, type Person, type TestEnv } from './env';

export function registerSuites(makeEnv: () => Promise<TestEnv>): void {
  let env: TestEnv;
  let ana: Person;

  beforeEach(async () => {
    env = await makeEnv();
    ana = await env.signup('Ana');
  });
  afterEach(async () => {
    await env.dispose();
  });

  const api = () => env.backend;
  const wid = () => ana.workspaceId;

  /** Convida e faz a pessoa nova entrar no workspace da Ana. Termina logado como Ana. */
  async function join(name: string, role: 'admin' | 'member' = 'member'): Promise<Person> {
    const invite = await api().members.createInvite(wid(), { role, weeklyCapacityHours: 30 });
    const person = await env.signup(name);
    await api().members.acceptInvite(wid(), invite.id);
    await env.loginAs(ana);
    return person;
  }

  describe('autenticação e sessão', () => {
    it('cadastra, cria o workspace padrão e abre sessão', async () => {
      const { session } = ana;
      expect(session.user.name).toBe('Ana');
      expect(session.workspaces).toHaveLength(1);
      expect(session.workspaces[0]).toMatchObject({ name: 'Workspace de Ana', role: 'admin' });
      expect(session.user.currentWorkspaceId).toBe(session.workspaces[0]!.id);
      expect(session.user.preferences.timezone).toBe('America/Sao_Paulo');
    });

    it('recusa e-mail repetido', async () => {
      await api().session.logout();
      await expectCode(
        api().session.signup({ name: 'Outra', email: ana.account.email.toUpperCase(), password: 'senha-segura' }),
        'EMAIL_TAKEN',
      );
    });

    it('faz login e logout', async () => {
      await api().session.logout();
      expect(await api().session.get()).toBeNull();
      await expectCode(api().projects.list(wid()), 'UNAUTHORIZED');
      await expectCode(api().session.login({ email: ana.account.email, password: 'errada' }), 'INVALID_CREDENTIALS');
      const session = await api().session.login({ email: ana.account.email, password: 'senha-segura' });
      expect(session.user.email).toBe(ana.account.email);
    });

    it('atualiza preferências e nome, e troca a senha', async () => {
      const updated = await api().session.updateProfile({ name: 'Ana Souza', preferences: { theme: 'light', locale: 'en' } });
      expect(updated.user.preferences).toMatchObject({ theme: 'light', locale: 'en', weekStart: 1 });
      const members = await api().members.list(wid());
      expect(members[0]!.name).toBe('Ana Souza');

      await expectCode(api().session.changePassword({ currentPassword: 'x', newPassword: 'nova-senha-1' }), 'WRONG_PASSWORD');
      await api().session.changePassword({ currentPassword: 'senha-segura', newPassword: 'nova-senha-1' });
      await api().session.logout();
      await expectCode(api().session.login({ email: ana.account.email, password: 'senha-segura' }), 'INVALID_CREDENTIALS');
      await api().session.login({ email: ana.account.email, password: 'nova-senha-1' });
    });

    it('cria outro workspace e troca o atual', async () => {
      const second = await api().workspaces.create('Pessoal');
      let session = (await api().session.get())!;
      expect(session.workspaces.map((w) => w.name)).toEqual(['Pessoal', 'Workspace de Ana']);
      expect(session.user.currentWorkspaceId).toBe(second.id);
      session = await api().session.switchWorkspace(wid());
      expect(session.user.currentWorkspaceId).toBe(wid());
    });
  });

  describe('workspaces, membros e convites', () => {
    it('isola os dados entre workspaces', async () => {
      await api().projects.create(wid(), { name: 'Secreto', color: '#0b83d9' });
      await env.signup('Bruno');
      await expectCode(api().projects.list(wid()), 'NOT_FOUND');
      await expectCode(api().tasks.create(wid(), { name: 'Intrusa' }), 'NOT_FOUND');
    });

    it('convite por link: a pessoa entra com o papel e a capacidade definidos', async () => {
      const invite = await api().members.createInvite(wid(), { email: 'bruno@exemplo.com', weeklyCapacityHours: 30 });
      expect(invite).toMatchObject({ role: 'member', weeklyCapacityHours: 30, workspaceName: 'Workspace de Ana' });
      expect(await api().members.listInvites(wid())).toHaveLength(1);

      const bruno = await env.signup('Bruno');
      expect((await api().members.getInvite(wid(), invite.id)).workspaceName).toBe('Workspace de Ana');
      await api().members.acceptInvite(wid(), invite.id);
      const session = (await api().session.get())!;
      expect(session.user.currentWorkspaceId).toBe(wid());
      expect(session.workspaces.find((w) => w.id === wid())?.role).toBe('member');
      const members = await api().members.list(wid());
      expect(members.find((m) => m.userId === bruno.uid)).toMatchObject({ role: 'member', weeklyCapacityHours: 30 });

      // O link vale uma vez.
      await expectCode(api().members.acceptInvite(wid(), invite.id), 'INVITE_NOT_FOUND');
      // Membro comum não administra o workspace.
      await expectCode(api().members.createInvite(wid(), {}), 'FORBIDDEN');
      await expectCode(api().workspaces.update(wid(), { name: 'Meu' }), 'FORBIDDEN');
      await expectCode(api().holidays.create(wid(), { date: '2026-12-24', name: 'Véspera' }), 'FORBIDDEN');
      expect(await api().holidays.list(wid())).toEqual([]);
    });

    it('convite de administrador dá papel de administrador', async () => {
      const carla = await join('Carla', 'admin');
      await env.loginAs(carla);
      const session = (await api().session.get())!;
      expect(session.workspaces.find((w) => w.id === wid())?.role).toBe('admin');
      await api().workspaces.update(wid(), { name: 'Workspace da equipe' });
    });

    it('admin revoga convite', async () => {
      const invite = await api().members.createInvite(wid(), {});
      await api().members.revokeInvite(wid(), invite.id);
      await env.signup('Bruno');
      await expectCode(api().members.acceptInvite(wid(), invite.id), 'INVITE_NOT_FOUND');
    });

    it('não deixa o workspace sem administrador', async () => {
      await expectCode(api().members.update(wid(), ana.uid, { role: 'member' }), 'LAST_ADMIN');
      await expectCode(api().members.remove(wid(), ana.uid), 'LAST_ADMIN');
    });

    it('remover membro tira das tarefas e do acesso; desativar também bloqueia', async () => {
      const bruno = await join('Bruno');
      const carla = await join('Carla');
      const task = await api().tasks.create(wid(), { name: 'Revisar', assigneeIds: [bruno.uid, ana.uid] });
      await api().members.remove(wid(), bruno.uid);
      const [after] = (await api().tasks.list(wid())).filter((t) => t.id === task.id);
      expect(after!.assigneeIds).toEqual([ana.uid]);

      await api().members.update(wid(), carla.uid, { active: false });
      await env.loginAs(bruno);
      await expectCode(api().tasks.list(wid()), 'NOT_FOUND');
      await env.loginAs(carla);
      await expectCode(api().tasks.list(wid()), 'NOT_FOUND');
      await env.loginAs(ana);
      await api().members.update(wid(), carla.uid, { active: true });
      await env.loginAs(carla);
      expect(await api().tasks.list(wid())).toHaveLength(1);
    });

    it('atualiza dias úteis e agendamento automático', async () => {
      const workspace = await api().workspaces.update(wid(), { workingDays: [5, 1, 2, 3, 4, 6], autoSchedule: false });
      expect(workspace).toMatchObject({ workingDays: [1, 2, 3, 4, 5, 6], autoSchedule: false });
    });
  });

  describe('tarefas', () => {
    let projectId: string;
    beforeEach(async () => {
      projectId = (await api().projects.create(wid(), { name: 'Site', color: '#0b83d9' })).id;
    });
    const create = (input: Parameters<TestEnv['backend']['tasks']['create']>[1]) =>
      api().tasks.create(wid(), { projectId, ...input });
    const get = async (id: string): Promise<Task> => (await api().tasks.list(wid())).find((task) => task.id === id)!;

    it('cria com responsáveis e tags', async () => {
      const tag = await api().tags.create(wid(), 'Front');
      const task = await create({ name: 'Layout', assigneeIds: [ana.uid], tagIds: [tag.id], priority: 3 });
      expect(task).toMatchObject({ name: 'Layout', status: 'todo', priority: 3, assigneeIds: [ana.uid], tagIds: [tag.id] });
      expect((await api().tasks.list(wid())).map((t) => t.id)).toEqual([task.id]);
    });

    it('recusa responsável que não é membro', async () => {
      await expectCode(create({ name: 'X', assigneeIds: ['alguem'] }), 'INVALID_ASSIGNEE');
    });

    it('normaliza datas: só início vira um dia, marco tem início igual ao fim', async () => {
      expect(await create({ name: 'Reunião', startDate: '2026-10-14' })).toMatchObject({
        startDate: '2026-10-14',
        dueDate: '2026-10-14',
      });
      expect(await create({ name: 'Entrega', dueDate: '2026-10-30', isMilestone: true })).toMatchObject({
        startDate: '2026-10-30',
        dueDate: '2026-10-30',
      });
      await expectCode(create({ name: 'X', startDate: '2026-10-20', dueDate: '2026-10-10' }), 'INVALID_DATES');
    });

    it('concluir marca 100% e reabrir zera o progresso', async () => {
      const task = await create({ name: 'Revisar', progress: 40 });
      const done = await api().tasks.update(wid(), task.id, { status: 'done' });
      expect(done.progress).toBe(100);
      expect(done.completedAt).not.toBeNull();
      expect(await api().tasks.update(wid(), task.id, { status: 'todo' })).toMatchObject({ progress: 0, completedAt: null });
    });

    it('subtarefa herda o projeto e a mãe acompanha as datas, o progresso e o status das filhas', async () => {
      const parent = await create({ name: 'Fase 1' });
      const a = await create({ name: 'A', parentId: parent.id, projectId: null, startDate: '2026-10-12', dueDate: '2026-10-14', progress: 100 });
      const b = await create({ name: 'B', parentId: parent.id, startDate: '2026-10-15', dueDate: '2026-10-16' });
      expect(a.projectId).toBe(projectId);
      expect(await get(parent.id)).toMatchObject({ startDate: '2026-10-12', dueDate: '2026-10-16', progress: 60, status: 'todo' });
      await api().tasks.update(wid(), a.id, { status: 'in_progress' });
      expect((await get(parent.id)).status).toBe('in_progress');
      await api().tasks.update(wid(), a.id, { status: 'done' });
      await api().tasks.update(wid(), b.id, { status: 'done' });
      expect(await get(parent.id)).toMatchObject({ status: 'done', progress: 100 });
    });

    it('mover a mãe de projeto leva as subtarefas e impede mãe descendente', async () => {
      const other = await api().projects.create(wid(), { name: 'Outro', color: '#9e5bd9' });
      const parent = await create({ name: 'Mãe' });
      const child = await create({ name: 'Filha', parentId: parent.id });
      await expectCode(api().tasks.update(wid(), parent.id, { parentId: child.id }), 'INVALID_PARENT');
      await api().tasks.update(wid(), parent.id, { projectId: other.id });
      expect((await get(child.id)).projectId).toBe(other.id);
    });

    it('excluir tarefa leva as subtarefas, as dependências e solta os apontamentos', async () => {
      const parent = await create({ name: 'Mãe' });
      const child = await create({ name: 'Filha', parentId: parent.id, startDate: '2026-10-12' });
      const other = await create({ name: 'Outra', startDate: '2026-10-13' });
      await api().dependencies.create(wid(), { predecessorId: child.id, successorId: other.id });
      const entry = await api().timeEntries.create(wid(), {
        taskId: child.id,
        start: '2026-10-12T12:00:00.000Z',
        stop: '2026-10-12T13:00:00.000Z',
      });
      await api().tasks.remove(wid(), parent.id);
      expect((await api().tasks.list(wid())).map((t) => t.id)).toEqual([other.id]);
      expect(await api().dependencies.list(wid())).toEqual([]);
      const [kept] = await api().timeEntries.list(wid(), '2026-10-12T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
      expect(kept).toMatchObject({ id: entry.id, taskId: null, projectId });
    });

    it('excluir projeto remove as tarefas (só administrador)', async () => {
      await create({ name: 'Some' });
      const bruno = await join('Bruno');
      await env.loginAs(bruno);
      await expectCode(api().projects.remove(wid(), projectId), 'FORBIDDEN');
      await env.loginAs(ana);
      await api().projects.remove(wid(), projectId);
      expect(await api().tasks.list(wid())).toEqual([]);
    });
  });

  describe('dependências e cascata', () => {
    const create = (input: Parameters<TestEnv['backend']['tasks']['create']>[1]) => api().tasks.create(wid(), input);
    const get = async (id: string): Promise<Task> => (await api().tasks.list(wid())).find((task) => task.id === id)!;

    it('cria dependência e empurra a sucessora', async () => {
      const a = await create({ name: 'A', startDate: '2026-10-12', dueDate: '2026-10-16' });
      const b = await create({ name: 'B', startDate: '2026-10-14', dueDate: '2026-10-15' });
      const dep = await api().dependencies.create(wid(), { predecessorId: a.id, successorId: b.id });
      expect(dep).toMatchObject({ type: 'FS', lagDays: 0 });
      expect(await get(b.id)).toMatchObject({ startDate: '2026-10-19', dueDate: '2026-10-20' });
    });

    it('mover a predecessora pelo lote do Gantt devolve a cascata', async () => {
      const a = await create({ name: 'A', startDate: '2026-10-12', dueDate: '2026-10-13' });
      const b = await create({ name: 'B', startDate: '2026-10-14', dueDate: '2026-10-14' });
      const c = await create({ name: 'C', startDate: '2026-10-15', dueDate: '2026-10-15' });
      await api().dependencies.create(wid(), { predecessorId: a.id, successorId: b.id });
      await api().dependencies.create(wid(), { predecessorId: b.id, successorId: c.id });
      const { tasks } = await api().tasks.schedule(wid(), { updates: [{ id: a.id, startDate: '2026-10-14', dueDate: '2026-10-15' }] });
      expect(tasks.map((t) => t.id).sort()).toEqual([a.id, b.id, c.id].sort());
      expect(await get(c.id)).toMatchObject({ startDate: '2026-10-19', dueDate: '2026-10-19' });
    });

    it('respeita agendamento automático desligado', async () => {
      await api().workspaces.update(wid(), { autoSchedule: false });
      const a = await create({ name: 'A', startDate: '2026-10-12', dueDate: '2026-10-16' });
      const b = await create({ name: 'B', startDate: '2026-10-13', dueDate: '2026-10-13' });
      await api().dependencies.create(wid(), { predecessorId: a.id, successorId: b.id });
      expect((await get(b.id)).startDate).toBe('2026-10-13');
    });

    it('recusa ciclo, duplicata e ligação com a mãe', async () => {
      const a = await create({ name: 'A' });
      const b = await create({ name: 'B' });
      const child = await create({ name: 'Filha', parentId: a.id });
      await api().dependencies.create(wid(), { predecessorId: a.id, successorId: b.id });
      await expectCode(api().dependencies.create(wid(), { predecessorId: b.id, successorId: a.id }), 'DEPENDENCY_DUPLICATE');
      await expectCode(api().dependencies.create(wid(), { predecessorId: a.id, successorId: child.id }), 'DEPENDENCY_HIERARCHY');
      await expectCode(api().dependencies.create(wid(), { predecessorId: b.id, successorId: child.id }), 'DEPENDENCY_CYCLE');
    });

    it('altera o atraso e remove a dependência', async () => {
      const a = await create({ name: 'A', startDate: '2026-10-12', dueDate: '2026-10-12' });
      const b = await create({ name: 'B', startDate: '2026-10-13', dueDate: '2026-10-13' });
      const dep = await api().dependencies.create(wid(), { predecessorId: a.id, successorId: b.id });
      expect((await api().dependencies.update(wid(), dep.id, { lagDays: 2 })).lagDays).toBe(2);
      expect((await get(b.id)).startDate).toBe('2026-10-15');
      await api().dependencies.remove(wid(), dep.id);
      expect(await api().dependencies.list(wid())).toHaveLength(0);
    });
  });

  describe('feriados', () => {
    it('cadastra, lista, recusa data repetida e exclui', async () => {
      const holiday = await api().holidays.create(wid(), { date: '2026-10-12', name: 'Nossa Senhora Aparecida' });
      expect(holiday).toMatchObject({ id: '2026-10-12', date: '2026-10-12', name: 'Nossa Senhora Aparecida' });
      await expectCode(api().holidays.create(wid(), { date: '2026-10-12', name: 'Outro' }), 'DATE_TAKEN');
      expect(await api().holidays.list(wid())).toHaveLength(1);
      await api().holidays.remove(wid(), holiday.id);
      expect(await api().holidays.list(wid())).toHaveLength(0);
    });

    it('importa os feriados nacionais sem duplicar', async () => {
      const first = await api().holidays.importNational(wid(), { year: 2026 });
      expect(first.created).toBe(10);
      expect(first.holidays.map((h) => h.date)).toContain('2026-04-03');
      expect((await api().holidays.importNational(wid(), { year: 2026, includeOptional: true })).created).toBe(3);
    });

    it('a cascata pula o feriado, mas a tarefa liberada pode cair nele', async () => {
      await api().holidays.create(wid(), { date: '2026-10-19', name: 'Feriado local' });
      const a = await api().tasks.create(wid(), { name: 'A', startDate: '2026-10-14', dueDate: '2026-10-16' });
      const normal = await api().tasks.create(wid(), { name: 'Normal', startDate: '2026-10-15', dueDate: '2026-10-15' });
      const weekend = await api().tasks.create(wid(), {
        name: 'Plantão',
        startDate: '2026-10-15',
        dueDate: '2026-10-15',
        allowNonWorkingDays: true,
      });
      await api().dependencies.create(wid(), { predecessorId: a.id, successorId: normal.id });
      await api().dependencies.create(wid(), { predecessorId: a.id, successorId: weekend.id });
      const tasks = await api().tasks.list(wid());
      expect(tasks.find((t) => t.id === normal.id)!.startDate).toBe('2026-10-20');
      expect(tasks.find((t) => t.id === weekend.id)!.startDate).toBe('2026-10-17');
    });
  });

  describe('cronômetro e apontamentos', () => {
    it('inicia, mostra como atual e para', async () => {
      const entry = await api().timeEntries.start(wid(), { description: 'Escrevendo' });
      expect(entry.stop).toBeNull();
      expect((await api().session.runningTimer())?.id).toBe(entry.id);
      const stopped = await api().timeEntries.stop(wid(), entry.id);
      expect(stopped.stop).not.toBeNull();
      expect(await api().session.runningTimer()).toBeNull();
    });

    it('iniciar outro cronômetro para o anterior, mesmo em outro workspace', async () => {
      const first = await api().timeEntries.start(wid(), { description: 'Um' });
      const other = await api().workspaces.create('Pessoal');
      const second = await api().timeEntries.start(other.id, { description: 'Dois' });
      expect((await api().session.runningTimer())?.id).toBe(second.id);
      const now = new Date();
      const from = new Date(now.getTime() - 3_600_000).toISOString();
      const to = new Date(now.getTime() + 3_600_000).toISOString();
      const [stopped] = await api().timeEntries.list(wid(), from, to);
      expect(stopped).toMatchObject({ id: first.id });
      expect(stopped!.stop).not.toBeNull();
    });

    it('apontamento de tarefa herda projeto e faturável', async () => {
      const project = await api().projects.create(wid(), { name: 'Cliente', color: '#d94182', billable: true });
      const task = await api().tasks.create(wid(), { name: 'Tela', projectId: project.id });
      const entry = await api().timeEntries.start(wid(), { taskId: task.id });
      expect(entry).toMatchObject({ projectId: project.id, taskId: task.id, billable: true });
    });

    it('cria, lista por intervalo, edita e exclui', async () => {
      const entry = await api().timeEntries.create(wid(), {
        description: 'Reunião',
        start: '2026-10-12T12:00:00.000Z',
        stop: '2026-10-12T13:30:00.000Z',
      });
      expect(entry.duration).toBe(5400);
      expect(await api().timeEntries.list(wid(), '2026-10-12T00:00:00.000Z', '2026-10-13T00:00:00.000Z')).toHaveLength(1);
      expect(await api().timeEntries.list(wid(), '2026-10-13T00:00:00.000Z', '2026-10-14T00:00:00.000Z')).toHaveLength(0);
      const edited = await api().timeEntries.update(wid(), entry.id, { stop: '2026-10-12T14:00:00-03:00' });
      expect(edited.stop).toBe('2026-10-12T17:00:00.000Z');
      await api().timeEntries.remove(wid(), entry.id);
      expect(await api().timeEntries.list(wid(), '2026-10-12T00:00:00.000Z', '2026-10-13T00:00:00.000Z')).toHaveLength(0);
    });

    it('recusa fim antes do início', async () => {
      await expectCode(
        api().timeEntries.create(wid(), { start: '2026-10-12T12:00:00.000Z', stop: '2026-10-12T11:00:00.000Z' }),
        'INVALID_RANGE',
      );
    });

    it('soma as horas na tarefa e no projeto ao criar, editar, mover e excluir', async () => {
      const site = await api().projects.create(wid(), { name: 'Site', color: '#0b83d9' });
      const app = await api().projects.create(wid(), { name: 'App', color: '#9e5bd9' });
      const task = await api().tasks.create(wid(), { name: 'Layout', projectId: site.id });
      const tracked = async () => {
        const [projects, tasks] = await Promise.all([api().projects.list(wid()), api().tasks.list(wid())]);
        return {
          site: projects.find((p) => p.id === site.id)!.trackedSeconds,
          app: projects.find((p) => p.id === app.id)!.trackedSeconds,
          task: tasks.find((t) => t.id === task.id)!.trackedSeconds,
        };
      };
      const entry = await api().timeEntries.create(wid(), {
        taskId: task.id,
        start: '2026-10-12T12:00:00.000Z',
        stop: '2026-10-12T13:00:00.000Z',
      });
      expect(await tracked()).toEqual({ site: 3600, app: 0, task: 3600 });
      expect((await api().projects.list(wid())).find((p) => p.id === site.id)!.memberIds).toEqual([ana.uid]);
      await api().timeEntries.update(wid(), entry.id, { stop: '2026-10-12T14:00:00.000Z' });
      expect(await tracked()).toEqual({ site: 7200, app: 0, task: 7200 });
      await api().timeEntries.update(wid(), entry.id, { projectId: app.id });
      expect(await tracked()).toEqual({ site: 0, app: 7200, task: 0 });
      await api().timeEntries.remove(wid(), entry.id);
      expect(await tracked()).toEqual({ site: 0, app: 0, task: 0 });
    });

    it('não deixa editar apontamento de outra pessoa', async () => {
      const entry = await api().timeEntries.create(wid(), { start: '2026-10-12T12:00:00Z', stop: '2026-10-12T13:00:00Z' });
      const bruno = await join('Bruno');
      await env.loginAs(bruno);
      await expectCode(api().timeEntries.update(wid(), entry.id, { description: 'x' }), 'FORBIDDEN');
      await expectCode(api().timeEntries.remove(wid(), entry.id), 'FORBIDDEN');
    });
  });

  describe('relatórios', () => {
    it('agrupa por dia local, projeto e calcula valor faturável', async () => {
      await api().workspaces.update(wid(), { defaultHourlyRate: 100 });
      const project = await api().projects.create(wid(), { name: 'Site', color: '#0b83d9', billable: true, hourlyRate: 150 });
      // 02:00Z do dia 13 ainda é dia 12 em São Paulo (UTC-3).
      await api().timeEntries.create(wid(), { projectId: project.id, description: 'Layout', start: '2026-10-13T01:00:00Z', stop: '2026-10-13T02:00:00Z' });
      await api().timeEntries.create(wid(), { projectId: project.id, description: 'Layout', start: '2026-10-13T15:00:00Z', stop: '2026-10-13T15:30:00Z' });
      await api().timeEntries.create(wid(), { description: 'Sem projeto', billable: true, start: '2026-10-14T15:00:00Z', stop: '2026-10-14T16:00:00Z' });

      const query = { start: '2026-10-12', end: '2026-10-18', tz: 'America/Sao_Paulo' };
      const summary = await api().reports.summary(wid(), query);
      expect(summary.totalSeconds).toBe(9000);
      expect(summary.byDay.find((d) => d.date === '2026-10-12')!.seconds).toBe(3600);
      expect(summary.byDay.find((d) => d.date === '2026-10-13')!.seconds).toBe(1800);
      expect(summary.byDay).toHaveLength(7);
      const site = summary.byProject.find((p) => p.projectId === project.id)!;
      expect(site.amount).toBe(225);
      expect(site.items).toEqual([{ description: 'Layout', taskId: null, seconds: 5400 }]);
      expect(summary.amount).toBe(325);
      expect(summary.byUser).toEqual([{ userId: ana.uid, seconds: 9000, billableSeconds: 9000, amount: 325 }]);

      expect((await api().reports.summary(wid(), { ...query, projectIds: [NO_ID] })).totalSeconds).toBe(3600);
      expect((await api().reports.detailed(wid(), { ...query, billable: true, description: 'layout' })).rows).toHaveLength(2);
    });

    it('exporta CSV com separador brasileiro e recusa fuso inválido', async () => {
      await api().timeEntries.create(wid(), { description: '=SOMA(A1)', start: '2026-10-13T15:00:00Z', stop: '2026-10-13T16:00:00Z' });
      const csv = await api().reports.csv(wid(), { start: '2026-10-12', end: '2026-10-18', tz: 'America/Sao_Paulo' }, 'pt-BR');
      expect(csv.charCodeAt(0)).toBe(0xfeff);
      const lines = csv.slice(1).trim().split('\r\n');
      expect(lines[0]).toContain('Usuário;E-mail;Cliente');
      expect(lines[1]).toContain("'=SOMA(A1)");
      expect(lines[1]).toContain('2026-10-13;12:00:00');
      await expectCode(api().reports.summary(wid(), { start: '2026-10-12', end: '2026-10-18', tz: 'Lua/Base' }), 'INVALID_TIMEZONE');
    });
  });

  describe('projetos, clientes e tags', () => {
    it('fixar é preferência de cada pessoa', async () => {
      const project = await api().projects.create(wid(), { name: 'Site', color: '#0b83d9' });
      expect((await api().projects.update(wid(), project.id, { pinned: true })).pinned).toBe(true);
      const bruno = await join('Bruno');
      await env.loginAs(bruno);
      expect((await api().projects.list(wid()))[0]!.pinned).toBe(false);
    });

    it('conta tarefas e recusa datas invertidas', async () => {
      const project = await api().projects.create(wid(), { name: 'Site', color: '#0b83d9' });
      const task = await api().tasks.create(wid(), { name: 'A', projectId: project.id, assigneeIds: [ana.uid] });
      await api().tasks.create(wid(), { name: 'B', projectId: project.id });
      await api().tasks.update(wid(), task.id, { status: 'done' });
      expect((await api().projects.list(wid()))[0]).toMatchObject({ taskCount: 2, doneTaskCount: 1, memberIds: [ana.uid] });
      await expectCode(api().projects.update(wid(), project.id, { startDate: '2026-10-20', endDate: '2026-10-10' }), 'INVALID_DATES');
    });

    it('cliente com nome único; excluir deixa os projetos sem cliente', async () => {
      const client = await api().clients.create(wid(), { name: 'Padaria' });
      await expectCode(api().clients.create(wid(), { name: 'padaria' }), 'NAME_TAKEN');
      const project = await api().projects.create(wid(), { name: 'Site', color: '#0b83d9', clientId: client.id });
      expect((await api().clients.list(wid()))[0]!.projectCount).toBe(1);
      await api().clients.remove(wid(), client.id);
      expect((await api().projects.list(wid())).find((p) => p.id === project.id)!.clientId).toBeNull();
    });

    it('excluir tag tira das tarefas e dos apontamentos', async () => {
      const tag = await api().tags.create(wid(), 'Design');
      await expectCode(api().tags.create(wid(), 'Design'), 'NAME_TAKEN');
      const task = await api().tasks.create(wid(), { name: 'A', tagIds: [tag.id] });
      await api().timeEntries.create(wid(), { tagIds: [tag.id], start: '2026-10-12T12:00:00Z', stop: '2026-10-12T13:00:00Z' });
      expect((await api().tags.rename(wid(), tag.id, 'UI')).name).toBe('UI');
      await api().tags.remove(wid(), tag.id);
      expect((await api().tasks.list(wid())).find((t) => t.id === task.id)!.tagIds).toEqual([]);
      const [entry] = await api().timeEntries.list(wid(), '2026-10-12T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
      expect(entry!.tagIds).toEqual([]);
    });
  });

  describe('importação de tarefas por JSON', () => {
    const json = (value: unknown) => JSON.stringify(value);

    it('a revisão monta a árvore, resolve nomes e aplica a cascata sem gravar nada', async () => {
      const bruno = await join('Bruno');
      const site = await api().projects.create(wid(), { name: 'Site', color: '#0b83d9' });
      await api().tags.create(wid(), 'Design');
      await api().tasks.create(wid(), { name: 'Aprovação', projectId: site.id, startDate: '2026-10-19' });
      const before = (await api().tasks.list(wid())).length;

      const preview = await api().tasks.previewImport(
        wid(),
        json({
          project: 'site',
          tasks: [
            {
              ref: 'fase',
              name: 'Fase 1',
              subtasks: [
                {
                  ref: 'a',
                  name: 'A',
                  startDate: '2026-10-12',
                  durationDays: 3,
                  assignees: [bruno.account.email.toUpperCase()],
                  tags: ['design', 'Nova tag'],
                  priority: 'high',
                  estimateHours: 6,
                },
                { ref: 'b', name: 'B', startDate: '2026-10-13', dueDate: '2026-10-14', dependsOn: ['a'], dueDate2: 'ignorado' },
              ],
            },
            { name: 'Entrega', milestone: true, startDate: '2026-10-15', dependsOn: [{ task: 'aprovacao', lagDays: 1 }] },
          ],
        }),
      );
      expect(preview.issues).toEqual([]);
      expect(preview.canImport).toBe(true);
      expect(preview.rows.map((row) => [row.key, row.depth, row.name])).toEqual([
        ['1', 0, 'Fase 1'],
        ['1.1', 1, 'A'],
        ['1.2', 1, 'B'],
        ['2', 0, 'Entrega'],
      ]);
      const [fase, a, b, entrega] = preview.rows;
      expect(a).toMatchObject({
        projectId: site.id,
        startDate: '2026-10-12',
        dueDate: '2026-10-14',
        priority: 3,
        estimateSeconds: 6 * 3600,
        assigneeIds: [bruno.uid],
        tagNames: ['Design', 'Nova tag'],
      });
      // B depende de A (até 14): a cascata empurra para 15 e 16.
      expect(b).toMatchObject({ startDate: '2026-10-15', dueDate: '2026-10-16', rescheduled: true });
      expect(b!.dependencies).toEqual([{ name: 'A', type: 'FS', lagDays: 0 }]);
      // A mãe sem datas no arquivo só recebe o resumo das subtarefas: não conta como ajuste.
      expect(fase).toMatchObject({ startDate: '2026-10-12', dueDate: '2026-10-16', rescheduled: false });
      expect(a!.rescheduled).toBe(false);
      expect(entrega!.isMilestone).toBe(true);
      // Marco depois da Aprovação (19) com 1 dia útil de atraso: dia 20.
      expect(entrega).toMatchObject({ startDate: '2026-10-20', dueDate: '2026-10-20', rescheduled: true });
      expect(preview.newTags).toEqual(['Nova tag']);
      expect(preview.dependencyCount).toBe(2);
      expect(await api().tasks.list(wid())).toHaveLength(before);
    });

    it('importa tudo de uma vez: tarefas, subtarefas, dependências e tags novas', async () => {
      const site = await api().projects.create(wid(), { name: 'Site', color: '#0b83d9' });
      const result = await api().tasks.importJson(
        wid(),
        json([
          { ref: 'x', name: 'X', startDate: '2026-10-12', durationDays: 2, tags: ['QA'], subtasks: [{ name: 'X.1', status: 'done' }] },
          { name: 'Y', startDate: '2026-10-12', dependsOn: ['x'], estimateHours: 4, estimateMode: 'per_day' },
        ]),
        { defaultProjectId: site.id },
      );
      expect(result.created).toBe(3);
      const tasks = await api().tasks.list(wid());
      const x = tasks.find((task) => task.name === 'X')!;
      const child = tasks.find((task) => task.name === 'X.1')!;
      const y = tasks.find((task) => task.name === 'Y')!;
      expect(child).toMatchObject({ parentId: x.id, projectId: site.id, status: 'done', progress: 100 });
      expect(y).toMatchObject({ projectId: site.id, startDate: '2026-10-14', estimateMode: 'per_day', estimateSeconds: 4 * 3600 });
      expect(await api().dependencies.list(wid())).toEqual([
        expect.objectContaining({ predecessorId: x.id, successorId: y.id, type: 'FS', lagDays: 0 }),
      ]);
      expect((await api().tags.list(wid())).map((tag) => tag.name)).toEqual(['QA']);
    });

    it('erros no arquivo impedem a importação e nada é gravado', async () => {
      const invalid = await api().tasks.previewImport(wid(), '{ "tasks": [');
      expect(invalid.issues[0]).toMatchObject({ level: 'error', code: 'INVALID_JSON' });

      const schema = await api().tasks.previewImport(wid(), json({ tasks: [{ name: 'A', startDate: '12/10/2026' }] }));
      expect(schema.issues[0]).toMatchObject({ code: 'SCHEMA_DATE', path: 'tasks[0].startDate' });

      const text = json({
        tasks: [
          { ref: 'a', name: 'A', project: 'Inexistente' },
          { ref: 'a', name: 'B', startDate: '2026-10-20', dueDate: '2026-10-10' },
          { ref: 'c', name: 'C', dependsOn: ['d', 'fantasma'], assignees: ['ninguem@exemplo.com'] },
          { ref: 'd', name: 'D', dependsOn: ['c'] },
        ],
      });
      const preview = await api().tasks.previewImport(wid(), text);
      expect(preview.canImport).toBe(false);
      const codes = preview.issues.map((issue) => `${issue.level}:${issue.code}:${issue.taskKey}`);
      // Erros antes dos avisos e, dentro de cada nível, na ordem das tarefas do arquivo.
      expect(codes).toEqual([
        'error:UNKNOWN_PROJECT:1',
        'error:INVALID_DATES:2',
        'error:DUPLICATE_REF:2',
        'error:UNKNOWN_DEPENDENCY:3',
        'error:DEPENDENCY_CYCLE:4',
        'warning:UNKNOWN_ASSIGNEE:3',
      ]);
      await expectCode(api().tasks.importJson(wid(), text), 'IMPORT_INVALID');
      expect(await api().tasks.list(wid())).toEqual([]);
    });
  });

  describe('demonstração', () => {
    it('cria um workspace de exemplo coerente', async () => {
      const demo = await api().workspaces.create('Estúdio Aurora', { demo: true });
      const [projects, tasks, dependencies, members, holidays] = await Promise.all([
        api().projects.list(demo.id),
        api().tasks.list(demo.id),
        api().dependencies.list(demo.id),
        api().members.list(demo.id),
        api().holidays.list(demo.id),
      ]);
      expect(projects).toHaveLength(4);
      expect(tasks.length).toBeGreaterThan(25);
      expect(dependencies).toHaveLength(18);
      expect(members).toHaveLength(4);
      expect(holidays.length).toBeGreaterThanOrEqual(20);
      const design = tasks.find((task) => task.name === 'Design')!;
      expect(design.startDate! <= design.dueDate!).toBe(true);
      const site = projects.find((project) => project.name === 'Site institucional')!;
      expect(site.trackedSeconds).toBeGreaterThan(0);
      expect(site.memberIds.length).toBeGreaterThan(1);
    });
  });
}
