// Dados de demonstração relativos à data de hoje, para o sistema abrir "vivo":
// projetos com cronograma e dependências, equipe com capacidade e duas semanas de
// apontamentos. Monta tudo em memória e grava em poucos lotes (no Firestore, criar
// item por item levaria minutos). As regras de datas e tarefas-mãe são as mesmas
// dos serviços (normalizeDates e applyScheduling).
import {
  addDays,
  brazilianHolidays,
  isWorkday,
  startOfWeekIso,
  toIsoDate,
  type Id,
  type Priority,
  type TaskStatus,
} from '@ott/shared';
import {
  paths,
  type ClientDoc,
  type DependencyDoc,
  type HolidayDoc,
  type MemberDoc,
  type ProjectDoc,
  type TagDoc,
  type TaskDoc,
  type TimeEntryDoc,
  type UserDoc,
  type WorkspaceDoc,
} from '../store/schema';
import { Batch } from '../store/types';
import { loadAdminWorkspace, nowIso, type Ctx } from './context';
import { applyScheduling, nextPosition, normalizeDates } from './tasks';
import { avatarColorFor } from './users';

export const DEMO_EMAIL = 'demo@exemplo.com';
export const DEMO_PASSWORD = 'demo1234';
export const DEMO_NAME = 'Ana Souza';
export const DEMO_WORKSPACE = 'Estúdio Aurora';

type Person = 'ana' | 'bruno' | 'carla' | 'diego';

interface TaskSpec {
  key: string;
  name: string;
  parent?: string;
  start?: number;
  end?: number;
  status?: TaskStatus;
  progress?: number;
  priority?: Priority;
  estimateHours?: number;
  assignees?: Person[];
  milestone?: boolean;
  allowNonWorkingDays?: boolean;
  tags?: string[];
  description?: string;
  dueToday?: boolean;
}

/** Equipe fictícia da demonstração: aparece como membro, mas não tem conta para entrar. */
const TEAM: { key: Exclude<Person, 'ana'>; name: string; email: string; capacity: number }[] = [
  { key: 'bruno', name: 'Bruno Lima', email: 'bruno@exemplo.com', capacity: 40 },
  { key: 'carla', name: 'Carla Mendes', email: 'carla@exemplo.com', capacity: 32 },
  { key: 'diego', name: 'Diego Rocha', email: 'diego@exemplo.com', capacity: 20 },
];

/** Preenche um workspace (de quem está logado, como admin) com os dados de exemplo. */
export async function seedDemoWorkspace(ctx: Ctx, workspaceId: Id): Promise<void> {
  const { uid, doc: workspace } = await loadAdminWorkspace(ctx, workspaceId);
  const owner = await ctx.store.get<UserDoc>(paths.users, uid);
  if (!owner) throw new Error('Perfil não encontrado');
  const now = nowIso(ctx);
  const today = toIsoDate(ctx.now());
  const week = startOfWeekIso(today, 1);
  const day = (offset: number) => addDays(week, offset);
  const batch = new Batch();
  const id = () => ctx.store.newId();

  // Equipe ---------------------------------------------------------------------
  const people: Record<Person, Id> = { ana: uid, bruno: '', carla: '', diego: '' };
  const members: MemberDoc[] = [];
  for (const person of TEAM) {
    people[person.key] = `demo-${id()}`;
    members.push({
      userId: people[person.key],
      workspaceId,
      name: person.name,
      email: person.email,
      avatarColor: avatarColorFor(person.email),
      role: 'member',
      weeklyCapacityHours: person.capacity,
      hourlyRate: null,
      active: true,
      joinedAt: now,
    });
  }
  for (const member of members) batch.set(paths.members(workspaceId), member.userId, member);
  const workspaceChanges: Partial<WorkspaceDoc> = {
    currency: 'BRL',
    defaultHourlyRate: 120,
    memberIds: [...new Set([...workspace.memberIds, ...members.map((member) => member.userId)])],
  };
  batch.update(paths.workspaces, workspaceId, workspaceChanges);

  // Feriados nacionais do ano atual e do próximo, como faria o botão de importar.
  const year = Number(today.slice(0, 4));
  const holidays = new Set<string>();
  for (const seed of [...brazilianHolidays(year), ...brazilianHolidays(year + 1)]) {
    if (holidays.has(seed.date)) continue;
    holidays.add(seed.date);
    const holiday: HolidayDoc = { id: seed.date, workspaceId, date: seed.date, name: seed.name };
    batch.set(paths.holidays(workspaceId), holiday.id, holiday);
  }
  const calendar = { workingDays: workspace.workingDays, holidays };

  // Clientes, tags e projetos ----------------------------------------------------
  const client = (name: string): Id => {
    const doc: ClientDoc = { id: id(), workspaceId, name, archived: false, createdAt: now };
    batch.set(paths.clients(workspaceId), doc.id, doc);
    return doc.id;
  };
  const clients = { padaria: client('Padaria Pão Dourado'), clinica: client('Clínica Vida') };
  const tags: Record<string, Id> = {};
  for (const name of ['Design', 'Front-end', 'Back-end', 'Reunião', 'Revisão']) {
    const doc: TagDoc = { id: id(), workspaceId, name, createdAt: now };
    batch.set(paths.tags(workspaceId), doc.id, doc);
    tags[name] = doc.id;
  }

  const projectDocs = new Map<Id, ProjectDoc>();
  const project = (input: Partial<ProjectDoc> & Pick<ProjectDoc, 'name' | 'color'>): Id => {
    const doc: ProjectDoc = {
      id: id(),
      workspaceId,
      clientId: null,
      billable: false,
      estimateSeconds: null,
      hourlyRate: null,
      startDate: null,
      endDate: null,
      archived: false,
      trackedSeconds: 0,
      trackerIds: [],
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    projectDocs.set(doc.id, doc);
    return doc.id;
  };
  const projects = {
    site: project({
      name: 'Site institucional',
      color: '#0b83d9',
      clientId: clients.padaria,
      billable: true,
      hourlyRate: 150,
      estimateSeconds: 160 * 3600,
      startDate: day(-14),
      endDate: day(30),
    }),
    app: project({
      name: 'App de agendamento',
      color: '#9e5bd9',
      clientId: clients.clinica,
      billable: true,
      estimateSeconds: 240 * 3600,
      startDate: day(-7),
      endDate: day(53),
    }),
    marketing: project({ name: 'Marketing interno', color: '#e36a00', estimateSeconds: 40 * 3600 }),
    suporte: project({ name: 'Suporte', color: '#2da608' }),
  };

  // Tarefas ----------------------------------------------------------------------
  const working = new Map<Id, TaskDoc>();
  const createTasks = (projectId: Id | null, specs: TaskSpec[]) => {
    const ids: Record<string, Id> = {};
    for (const spec of specs) {
      const parentId = spec.parent ? ids[spec.parent]! : null;
      const status = spec.status ?? 'todo';
      const isMilestone = spec.milestone ?? false;
      const dates = normalizeDates(
        spec.dueToday ? null : spec.start === undefined ? null : day(spec.start),
        spec.dueToday ? today : spec.end === undefined ? null : day(spec.end),
        isMilestone,
      );
      const task: TaskDoc = {
        id: id(),
        workspaceId,
        projectId,
        parentId,
        name: spec.name,
        description: spec.description ?? '',
        notes: '',
        status,
        priority: spec.priority ?? 0,
        ...dates,
        estimateSeconds: spec.estimateHours ? spec.estimateHours * 3600 : null,
        estimateMode: 'total',
        progress: status === 'done' ? 100 : (spec.progress ?? 0),
        isMilestone,
        allowNonWorkingDays: spec.allowNonWorkingDays ?? false,
        billable: false,
        position: nextPosition(working.values(), parentId),
        assigneeIds: (spec.assignees ?? []).map((key) => people[key]),
        tagIds: (spec.tags ?? []).map((name) => tags[name]!),
        trackedSeconds: 0,
        createdBy: uid,
        createdAt: now,
        updatedAt: now,
        completedAt: status === 'done' ? now : null,
      };
      working.set(task.id, task);
      ids[spec.key] = task.id;
    }
    return ids;
  };

  const site = createTasks(projects.site, [
    { key: 'disc', name: 'Descoberta' },
    { key: 'entrevistas', parent: 'disc', name: 'Entrevistas com o cliente', start: -14, end: -12, status: 'done', estimateHours: 8, assignees: ['ana'], tags: ['Reunião'] },
    { key: 'mapa', parent: 'disc', name: 'Mapa do site e conteúdo', start: -11, end: -8, status: 'done', estimateHours: 12, assignees: ['ana', 'carla'] },
    { key: 'design', name: 'Design' },
    { key: 'wire', parent: 'design', name: 'Wireframes', start: -7, end: -3, status: 'done', estimateHours: 16, assignees: ['carla'], tags: ['Design'] },
    { key: 'visual', parent: 'design', name: 'Identidade visual das páginas', start: -2, end: 2, status: 'in_progress', progress: 60, priority: 3, estimateHours: 20, assignees: ['carla'], tags: ['Design'], description: 'Aplicar a paleta e a tipografia da marca nas páginas principais.' },
    { key: 'proto', parent: 'design', name: 'Protótipo navegável', start: 3, end: 7, priority: 2, estimateHours: 14, assignees: ['carla', 'ana'], tags: ['Design'] },
    { key: 'aprov', parent: 'design', name: 'Aprovação do layout', start: 7, milestone: true, assignees: ['ana'] },
    { key: 'dev', name: 'Desenvolvimento' },
    { key: 'repo', parent: 'dev', name: 'Configurar repositório e deploy', start: 0, end: 1, status: 'in_progress', progress: 50, priority: 2, estimateHours: 6, assignees: ['bruno'], tags: ['Back-end'] },
    { key: 'paginas', parent: 'dev', name: 'Páginas institucionais', start: 8, end: 16, priority: 3, estimateHours: 40, assignees: ['bruno'], tags: ['Front-end'] },
    { key: 'form', parent: 'dev', name: 'Formulário de encomendas', start: 14, end: 18, priority: 4, estimateHours: 16, assignees: ['bruno', 'diego'], tags: ['Front-end', 'Back-end'] },
    { key: 'insta', parent: 'dev', name: 'Integração com Instagram', start: 17, end: 21, priority: 1, estimateHours: 10, assignees: ['diego'], tags: ['Back-end'] },
    { key: 'pub', name: 'Testes e publicação' },
    { key: 'testes', parent: 'pub', name: 'Testes em navegadores e celulares', start: 22, end: 25, priority: 2, estimateHours: 12, assignees: ['diego', 'ana'], tags: ['Revisão'] },
    { key: 'ajustes', parent: 'pub', name: 'Ajustes finais', start: 28, end: 29, estimateHours: 8, assignees: ['bruno'] },
    { key: 'golive', parent: 'pub', name: 'Site no ar', start: 30, milestone: true, assignees: ['ana'] },
  ]);
  const app = createTasks(projects.app, [
    { key: 'req', name: 'Levantamento de requisitos', start: -7, end: -3, status: 'done', estimateHours: 16, assignees: ['ana'], tags: ['Reunião'] },
    { key: 'arq', name: 'Arquitetura e modelo de dados', start: -2, end: 1, status: 'in_progress', progress: 40, priority: 3, estimateHours: 16, assignees: ['bruno'], tags: ['Back-end'] },
    { key: 'backend', name: 'Back-end' },
    { key: 'api', parent: 'backend', name: 'API de agenda e horários', start: 2, end: 12, priority: 3, estimateHours: 48, assignees: ['bruno'], tags: ['Back-end'] },
    { key: 'notif', parent: 'backend', name: 'Notificações por WhatsApp', start: 13, end: 19, priority: 2, estimateHours: 24, assignees: ['diego'], tags: ['Back-end'] },
    { key: 'mobile', name: 'Aplicativo' },
    { key: 'telas', parent: 'mobile', name: 'Telas de agendamento', start: 2, end: 15, priority: 3, estimateHours: 56, assignees: ['carla', 'diego'], tags: ['Front-end', 'Design'] },
    { key: 'login', parent: 'mobile', name: 'Cadastro e login de pacientes', start: 16, end: 22, priority: 2, estimateHours: 24, assignees: ['carla'], tags: ['Front-end'] },
    { key: 'beta', name: 'Beta fechado com a clínica', start: 30, milestone: true, assignees: ['ana'] },
  ]);
  createTasks(projects.marketing, [
    { key: 'posts', name: 'Calendário de posts de novembro', start: 1, end: 4, priority: 2, estimateHours: 6, assignees: ['ana'] },
    { key: 'case', name: 'Estudo de caso da padaria', priority: 1, estimateHours: 8, assignees: ['carla'] },
    { key: 'news', name: 'Newsletter mensal', start: 9, end: 9, priority: 1, estimateHours: 3, assignees: ['ana'] },
    { key: 'portfolio', name: 'Atualizar portfólio no site', status: 'done', estimateHours: 4, assignees: ['carla'] },
  ]);
  createTasks(projects.suporte, [
    { key: 'backup', name: 'Verificar backups dos clientes', start: 0, end: 0, priority: 3, assignees: ['bruno'] },
    { key: 'ssl', name: 'Renovar certificados SSL', start: 4, end: 4, priority: 4, assignees: ['bruno'] },
    // Exemplo de tarefa liberada para fim de semana: a janela de manutenção é no sábado.
    { key: 'janela', name: 'Janela de manutenção dos servidores', start: 5, end: 6, allowNonWorkingDays: true, estimateHours: 6, priority: 3, assignees: ['bruno', 'diego'] },
  ]);
  createTasks(null, [
    { key: 'emails', name: 'Responder e-mails pendentes', priority: 1, dueToday: true, assignees: ['ana'] },
    { key: 'sprint', name: 'Planejar sprint da próxima semana', priority: 2, end: 4, assignees: ['ana'] },
  ]);

  // Dependências -------------------------------------------------------------------
  const dependencies: DependencyDoc[] = [];
  const link = (ids: Record<string, Id>, pairs: [string, string, number?][]) => {
    for (const [from, to, lagDays] of pairs) {
      dependencies.push({
        id: id(),
        workspaceId,
        predecessorId: ids[from]!,
        successorId: ids[to]!,
        type: 'FS',
        lagDays: lagDays ?? 0,
        createdAt: now,
      });
    }
  };
  link(site, [
    ['entrevistas', 'mapa'],
    ['mapa', 'wire'],
    ['wire', 'visual'],
    ['visual', 'proto'],
    ['proto', 'aprov'],
    ['aprov', 'paginas'],
    ['paginas', 'testes'],
    ['form', 'testes'],
    ['insta', 'testes'],
    ['testes', 'ajustes'],
    ['ajustes', 'golive'],
  ]);
  link(app, [
    ['req', 'arq'],
    ['arq', 'api'],
    ['arq', 'telas'],
    ['api', 'notif'],
    ['telas', 'login'],
    ['notif', 'beta', 2],
    ['login', 'beta'],
  ]);
  for (const dep of dependencies) batch.set(paths.dependencies(workspaceId), dep.id, dep);
  applyScheduling(working, dependencies, calendar, workspace.autoSchedule, now);

  // Apontamentos dos últimos 14 dias úteis, em horário de Brasília (UTC-3 fixo desde 2019).
  const plans: Record<Person, { project: Id; task?: Id; text: string; tag?: string }[]> = {
    ana: [
      { project: projects.site, task: site.entrevistas, text: 'Reunião com a padaria', tag: 'Reunião' },
      { project: projects.site, task: site.mapa, text: 'Mapa do site' },
      { project: projects.app, task: app.req, text: 'Requisitos com a clínica', tag: 'Reunião' },
      { project: projects.marketing, text: 'Posts para redes sociais' },
      { project: projects.site, task: site.visual, text: 'Revisão do layout', tag: 'Revisão' },
    ],
    bruno: [
      { project: projects.site, task: site.repo, text: 'Pipeline de deploy', tag: 'Back-end' },
      { project: projects.app, task: app.arq, text: 'Modelagem do banco', tag: 'Back-end' },
      { project: projects.suporte, text: 'Chamados de suporte' },
    ],
    carla: [
      { project: projects.site, task: site.wire, text: 'Wireframes da home', tag: 'Design' },
      { project: projects.site, task: site.visual, text: 'Componentes visuais', tag: 'Design' },
      { project: projects.marketing, text: 'Peças para Instagram', tag: 'Design' },
    ],
    diego: [
      { project: projects.app, text: 'Estudo da API do WhatsApp', tag: 'Back-end' },
      { project: projects.suporte, text: 'Atualização de plugins' },
    ],
  };
  const blocks: [string, string][] = [
    ['09:00', '10:30'],
    ['10:45', '12:15'],
    ['13:30', '15:00'],
    ['15:15', '16:45'],
    ['17:00', '18:00'],
  ];
  let seed = 7;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const nowMs = ctx.now().getTime();
  for (let offset = -14; offset <= 0; offset += 1) {
    const date = addDays(today, offset);
    if (!isWorkday(date, calendar)) continue;
    for (const [person, plan] of Object.entries(plans) as [Person, (typeof plans)[Person]][]) {
      const count = person === 'diego' ? 2 : offset === 0 ? 2 : 3 + Math.floor(random() * 2);
      for (let i = 0; i < count; i += 1) {
        const item = plan[Math.floor(random() * plan.length)]!;
        const [from, to] = blocks[i]!;
        const start = new Date(`${date}T${from}:00-03:00`);
        const stop = new Date(`${date}T${to}:00-03:00`);
        // Hoje só entra o que já terminou, para nada aparecer depois da linha de agora.
        if (stop.getTime() > nowMs) continue;
        const projectDoc = projectDocs.get(item.project)!;
        const entry: TimeEntryDoc = {
          id: id(),
          workspaceId,
          userId: people[person],
          projectId: item.project,
          taskId: item.task ?? null,
          description: item.text,
          start: start.toISOString(),
          stop: stop.toISOString(),
          billable: projectDoc.billable,
          tagIds: item.tag ? [tags[item.tag]!] : [],
          createdAt: now,
          updatedAt: now,
        };
        batch.set(paths.timeEntries(workspaceId), entry.id, entry);
        const seconds = Math.round((stop.getTime() - start.getTime()) / 1000);
        projectDoc.trackedSeconds += seconds;
        if (!projectDoc.trackerIds.includes(entry.userId)) projectDoc.trackerIds.push(entry.userId);
        if (item.task) working.get(item.task)!.trackedSeconds += seconds;
      }
    }
  }

  for (const doc of projectDocs.values()) batch.set(paths.projects(workspaceId), doc.id, doc);
  for (const task of working.values()) batch.set(paths.tasks(workspaceId), task.id, task);
  await ctx.store.commit(batch.ops);
}
