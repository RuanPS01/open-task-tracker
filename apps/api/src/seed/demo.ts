// Dados de demonstração relativos à data de hoje, para o sistema abrir "vivo":
// projetos com cronograma e dependências, equipe com capacidade e duas semanas de
// apontamentos. Usa os mesmos serviços das rotas, então respeita todas as regras.
import {
  addDays,
  isWorkday,
  startOfWeekIso,
  toIsoDate,
  type Workspace,
} from '@ott/shared';
import type { Db } from '../db/database';
import { hashPassword } from '../modules/auth/password';
import { insertClient } from '../modules/clients/repo';
import { insertMember } from '../modules/members/repo';
import { insertProject } from '../modules/projects/repo';
import { insertTag } from '../modules/tags/repo';
import { createDependency, createTask } from '../modules/tasks/service';
import { createTimeEntry } from '../modules/time-entries/service';
import { insertUser, setCurrentWorkspace } from '../modules/users/repo';
import { getWorkspaceForUser, insertWorkspace, updateWorkspace } from '../modules/workspaces/repo';

export const DEMO_EMAIL = 'demo@exemplo.com';
export const DEMO_PASSWORD = 'demo1234';

interface TaskSpec {
  key: string;
  name: string;
  parent?: string;
  start?: number;
  end?: number;
  status?: 'todo' | 'in_progress' | 'done';
  progress?: number;
  priority?: 0 | 1 | 2 | 3 | 4;
  estimateHours?: number;
  assignees?: string[];
  milestone?: boolean;
  tags?: string[];
  description?: string;
}

export async function seedDemo(db: Db, today = toIsoDate(new Date())): Promise<{ email: string; password: string }> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const week = startOfWeekIso(today, 1);
  const day = (offset: number) => addDays(week, offset);

  const people = {
    ana: insertUser(db, { name: 'Ana Souza', email: DEMO_EMAIL, passwordHash }),
    bruno: insertUser(db, { name: 'Bruno Lima', email: 'bruno@exemplo.com', passwordHash }),
    carla: insertUser(db, { name: 'Carla Mendes', email: 'carla@exemplo.com', passwordHash }),
    diego: insertUser(db, { name: 'Diego Rocha', email: 'diego@exemplo.com', passwordHash }),
  };

  const workspaceId = insertWorkspace(db, 'Estúdio Aurora', people.ana.id);
  updateWorkspace(db, workspaceId, { defaultHourlyRate: 120, currency: 'BRL' });
  const capacities = { bruno: 40, carla: 32, diego: 20 } as const;
  for (const [key, hours] of Object.entries(capacities)) {
    const user = people[key as keyof typeof capacities];
    insertMember(db, { workspaceId, userId: user.id, role: 'member', weeklyCapacityHours: hours, hourlyRate: null });
  }
  for (const user of Object.values(people)) setCurrentWorkspace(db, user.id, workspaceId);
  const workspace: Workspace = getWorkspaceForUser(db, workspaceId, people.ana.id)!;

  const clients = {
    padaria: insertClient(db, workspaceId, { name: 'Padaria Pão Dourado' }),
    clinica: insertClient(db, workspaceId, { name: 'Clínica Vida' }),
  };
  const tags = Object.fromEntries(
    ['Design', 'Front-end', 'Back-end', 'Reunião', 'Revisão'].map((name) => [name, insertTag(db, workspaceId, name)]),
  );

  const projects = {
    site: insertProject(db, workspaceId, {
      name: 'Site institucional',
      color: '#0b83d9',
      clientId: clients.padaria,
      billable: true,
      hourlyRate: 150,
      estimateSeconds: 160 * 3600,
      startDate: day(-14),
      endDate: day(30),
    }),
    app: insertProject(db, workspaceId, {
      name: 'App de agendamento',
      color: '#9e5bd9',
      clientId: clients.clinica,
      billable: true,
      estimateSeconds: 240 * 3600,
      startDate: day(-7),
      endDate: day(53),
    }),
    marketing: insertProject(db, workspaceId, {
      name: 'Marketing interno',
      color: '#e36a00',
      billable: false,
      estimateSeconds: 40 * 3600,
    }),
    suporte: insertProject(db, workspaceId, { name: 'Suporte', color: '#2da608', billable: false }),
  };

  const createTasks = (projectId: number, specs: TaskSpec[]) => {
    const ids: Record<string, number> = {};
    for (const spec of specs) {
      const task = createTask(db, workspace, people.ana.id, {
        name: spec.name,
        projectId,
        parentId: spec.parent ? ids[spec.parent] : undefined,
        description: spec.description,
        status: spec.status,
        progress: spec.progress,
        priority: spec.priority,
        startDate: spec.start === undefined ? undefined : day(spec.start),
        dueDate: spec.end === undefined ? undefined : day(spec.end),
        estimateSeconds: spec.estimateHours ? spec.estimateHours * 3600 : undefined,
        isMilestone: spec.milestone,
        assigneeIds: spec.assignees?.map((key) => people[key as keyof typeof people].id),
        tagIds: spec.tags?.map((name) => tags[name]!),
      });
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
    { key: 'proto', parent: 'design', name: 'Protótipo navegável', start: 3, end: 7, status: 'todo', priority: 2, estimateHours: 14, assignees: ['carla', 'ana'], tags: ['Design'] },
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
  const link = (ids: Record<string, number>, pairs: [string, string, number?][]) => {
    for (const [from, to, lagDays] of pairs) {
      createDependency(db, workspace, { predecessorId: ids[from]!, successorId: ids[to]!, type: 'FS', lagDays: lagDays ?? 0 });
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
  link(app, [
    ['req', 'arq'],
    ['arq', 'api'],
    ['arq', 'telas'],
    ['api', 'notif'],
    ['telas', 'login'],
    ['notif', 'beta', 2],
    ['login', 'beta'],
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
  ]);
  createTask(db, workspace, people.ana.id, { name: 'Responder e-mails pendentes', priority: 1, dueDate: today, assigneeIds: [people.ana.id] });
  createTask(db, workspace, people.ana.id, { name: 'Planejar sprint da próxima semana', priority: 2, dueDate: day(4), assigneeIds: [people.ana.id] });

  // Apontamentos dos últimos 14 dias úteis, em horário de Brasília (UTC-3 fixo desde 2019).
  const plans: Record<keyof typeof people, { project: number; task?: number; text: string; tag?: string }[]> = {
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
  for (let offset = -14; offset <= 0; offset += 1) {
    const date = addDays(today, offset);
    if (!isWorkday(date, workspace.workingDays)) continue;
    for (const [key, plan] of Object.entries(plans)) {
      const user = people[key as keyof typeof people];
      const count = key === 'diego' ? 2 : offset === 0 ? 2 : 3 + Math.floor(random() * 2);
      for (let i = 0; i < count; i += 1) {
        const item = plan[Math.floor(random() * plan.length)]!;
        const [from, to] = blocks[i]!;
        const stop = new Date(`${date}T${to}:00-03:00`);
        // Hoje só entra o que já terminou, para nada aparecer depois da linha de agora.
        if (stop.getTime() > Date.now()) continue;
        createTimeEntry(db, workspace, user.id, {
          description: item.text,
          projectId: item.project,
          taskId: item.task,
          tagIds: item.tag ? [tags[item.tag]!] : [],
          start: new Date(`${date}T${from}:00-03:00`).toISOString(),
          stop: stop.toISOString(),
        });
      }
    }
  }

  return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
}
