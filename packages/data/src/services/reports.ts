// Relatórios (resumo, detalhado e exportação CSV), calculados a partir dos apontamentos.
// O dia de um apontamento é o dia em que ele começou, no fuso pedido (tz). Mesmo
// critério do Toggl: um apontamento que atravessa a meia-noite conta no dia do início.
import {
  NO_ID,
  addDays,
  eachDay,
  formatClock,
  reportQuerySchema,
  type Id,
  type Locale,
  type ReportDetailed,
  type ReportDetailedRow,
  type ReportProjectRow,
  type ReportQueryInput,
  type ReportSummary,
  type Workspace,
} from '@ott/shared';
import { badRequest, parse } from '../errors';
import {
  paths,
  type ClientDoc,
  type MemberDoc,
  type ProjectDoc,
  type TagDoc,
  type TaskDoc,
  type TimeEntryDoc,
} from '../store/schema';
import { where } from '../store/types';
import { loadWorkspace, type Ctx } from './context';
import { entrySeconds } from './timeEntries';

const roundMoney = (value: number) => Math.round(value * 100) / 100;

function localDateFormatter(timeZone: string): (iso: string) => string {
  let formatter: Intl.DateTimeFormat;
  try {
    // en-CA formata como AAAA-MM-DD, que é exatamente o IsoDate.
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    throw badRequest('INVALID_TIMEZONE', `Fuso horário inválido: ${timeZone}`);
  }
  return (iso: string) => formatter.format(new Date(iso));
}

interface FilteredEntry extends ReportDetailedRow {
  clientId: Id | null;
}

interface ReportData {
  workspace: Workspace;
  entries: FilteredEntry[];
  projects: ProjectDoc[];
  members: MemberDoc[];
}

async function loadReport(ctx: Ctx, workspaceId: Id, raw: ReportQueryInput): Promise<ReportData & { tz: string }> {
  const { workspace } = await loadWorkspace(ctx, workspaceId);
  const query = parse(reportQuerySchema, raw);
  if (query.end < query.start) throw badRequest('INVALID_RANGE', 'Fim do período antes do início');
  const toLocalDate = localDateFormatter(query.tz);

  // Filtro largo em UTC (um dia de folga de cada lado cobre qualquer fuso);
  // o corte exato é feito abaixo, já com a data local.
  const [docs, projects, members] = await Promise.all([
    ctx.store.list<TimeEntryDoc>(paths.timeEntries(workspaceId), [
      where('start', '>=', `${addDays(query.start, -1)}T00:00:00.000Z`),
      where('start', '<', `${addDays(query.end, 2)}T00:00:00.000Z`),
    ]),
    ctx.store.list<ProjectDoc>(paths.projects(workspaceId)),
    ctx.store.list<MemberDoc>(paths.members(workspaceId)),
  ]);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const memberRate = new Map(members.map((member) => [member.userId, member.hourlyRate]));
  // Valor/hora: o do projeto vence o do membro, que vence o padrão do workspace.
  const hourlyRate = (projectId: Id | null, userId: Id) =>
    (projectId === null ? null : (projectById.get(projectId)?.hourlyRate ?? null)) ??
    memberRate.get(userId) ??
    workspace.defaultHourlyRate ??
    0;

  const now = ctx.now().getTime();
  const description = query.description?.trim().toLowerCase();
  const matches = (list: Id[] | undefined, value: Id | null) =>
    !list || list.length === 0 || list.includes(value ?? NO_ID);
  const entries: FilteredEntry[] = [];
  for (const entry of docs.sort((a, b) => b.start.localeCompare(a.start))) {
    const date = toLocalDate(entry.start);
    if (date < query.start || date > query.end) continue;
    if (query.userIds && query.userIds.length > 0 && !query.userIds.includes(entry.userId)) continue;
    // NO_ID nos filtros significa "sem projeto", "sem cliente", "sem tarefa" ou "sem tag".
    if (!matches(query.projectIds, entry.projectId)) continue;
    const clientId = entry.projectId === null ? null : (projectById.get(entry.projectId)?.clientId ?? null);
    if (!matches(query.clientIds, clientId)) continue;
    if (!matches(query.taskIds, entry.taskId)) continue;
    if (query.tagIds && query.tagIds.length > 0) {
      const wantsUntagged = query.tagIds.includes(NO_ID) && entry.tagIds.length === 0;
      if (!wantsUntagged && !entry.tagIds.some((id) => query.tagIds!.includes(id))) continue;
    }
    if (query.billable !== undefined && entry.billable !== query.billable) continue;
    if (description && !entry.description.toLowerCase().includes(description)) continue;

    const seconds = entrySeconds(entry.start, entry.stop, now);
    const amount = entry.billable ? roundMoney((seconds / 3600) * hourlyRate(entry.projectId, entry.userId)) : 0;
    entries.push({
      id: entry.id,
      userId: entry.userId,
      projectId: entry.projectId,
      taskId: entry.taskId,
      clientId,
      description: entry.description,
      start: entry.start,
      stop: entry.stop,
      date,
      seconds,
      billable: entry.billable,
      amount,
      tagIds: entry.tagIds,
    });
  }
  return { workspace, entries, projects, members, tz: query.tz };
}

export async function summaryReport(ctx: Ctx, workspaceId: Id, raw: ReportQueryInput): Promise<ReportSummary> {
  const query = parse(reportQuerySchema, raw);
  const { workspace, entries } = await loadReport(ctx, workspaceId, raw);
  const days = new Map(eachDay(query.start, query.end).map((date) => [date, { date, seconds: 0, billableSeconds: 0 }]));
  type ProjectAcc = ReportProjectRow & { itemMap: Map<string, { description: string; taskId: Id | null; seconds: number }> };
  const projects = new Map<Id | null, ProjectAcc>();
  const users = new Map<Id, { userId: Id; seconds: number; billableSeconds: number; amount: number }>();
  const clients = new Map<Id | null, { clientId: Id | null; seconds: number }>();

  let totalSeconds = 0;
  let billableSeconds = 0;
  let amount = 0;
  for (const entry of entries) {
    const billable = entry.billable ? entry.seconds : 0;
    totalSeconds += entry.seconds;
    billableSeconds += billable;
    amount += entry.amount;

    const day = days.get(entry.date);
    if (day) {
      day.seconds += entry.seconds;
      day.billableSeconds += billable;
    }

    let project = projects.get(entry.projectId);
    if (!project) {
      project = { projectId: entry.projectId, seconds: 0, billableSeconds: 0, amount: 0, items: [], itemMap: new Map() };
      projects.set(entry.projectId, project);
    }
    project.seconds += entry.seconds;
    project.billableSeconds += billable;
    project.amount += entry.amount;
    const itemKey = `${entry.taskId ?? ''}|${entry.description}`;
    const item = project.itemMap.get(itemKey) ?? { description: entry.description, taskId: entry.taskId, seconds: 0 };
    item.seconds += entry.seconds;
    project.itemMap.set(itemKey, item);

    const user = users.get(entry.userId) ?? { userId: entry.userId, seconds: 0, billableSeconds: 0, amount: 0 };
    user.seconds += entry.seconds;
    user.billableSeconds += billable;
    user.amount += entry.amount;
    users.set(entry.userId, user);

    const client = clients.get(entry.clientId) ?? { clientId: entry.clientId, seconds: 0 };
    client.seconds += entry.seconds;
    clients.set(entry.clientId, client);
  }

  const bySeconds = <T extends { seconds: number }>(a: T, b: T) => b.seconds - a.seconds;
  return {
    start: query.start,
    end: query.end,
    currency: workspace.currency,
    totalSeconds,
    billableSeconds,
    amount: roundMoney(amount),
    entryCount: entries.length,
    byDay: [...days.values()],
    byProject: [...projects.values()]
      .map(({ itemMap, ...row }) => ({
        ...row,
        amount: roundMoney(row.amount),
        items: [...itemMap.values()].sort(bySeconds),
      }))
      .sort(bySeconds),
    byUser: [...users.values()].map((row) => ({ ...row, amount: roundMoney(row.amount) })).sort(bySeconds),
    byClient: [...clients.values()].sort(bySeconds),
  };
}

export async function detailedReport(ctx: Ctx, workspaceId: Id, raw: ReportQueryInput): Promise<ReportDetailed> {
  const query = parse(reportQuerySchema, raw);
  const { workspace, entries } = await loadReport(ctx, workspaceId, raw);
  return {
    start: query.start,
    end: query.end,
    currency: workspace.currency,
    totalSeconds: entries.reduce((sum, entry) => sum + entry.seconds, 0),
    billableSeconds: entries.reduce((sum, entry) => sum + (entry.billable ? entry.seconds : 0), 0),
    amount: roundMoney(entries.reduce((sum, entry) => sum + entry.amount, 0)),
    rows: entries.map(({ clientId: _clientId, ...row }) => row),
  };
}

// --- CSV -------------------------------------------------------------------------
// Mesmas colunas do export do Toggl. Ponto e vírgula em pt-BR porque o Excel
// brasileiro trata vírgula como decimal.

const HEADERS: Record<Locale, string[]> = {
  'pt-BR': [
    'Usuário',
    'E-mail',
    'Cliente',
    'Projeto',
    'Tarefa',
    'Descrição',
    'Faturável',
    'Data de início',
    'Hora de início',
    'Data de fim',
    'Hora de fim',
    'Duração',
    'Tags',
    'Valor',
  ],
  en: [
    'User',
    'Email',
    'Client',
    'Project',
    'Task',
    'Description',
    'Billable',
    'Start date',
    'Start time',
    'End date',
    'End time',
    'Duration',
    'Tags',
    'Amount',
  ],
};

function escapeCell(value: string, separator: string): string {
  // Também neutraliza injeção de fórmula em planilhas (célula começando com = + - @).
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return safe.includes(separator) || safe.includes('"') || safe.includes('\n')
    ? `"${safe.replace(/"/g, '""')}"`
    : safe;
}

export async function detailedCsv(ctx: Ctx, workspaceId: Id, raw: ReportQueryInput, locale: Locale): Promise<string> {
  const { entries, projects, members, tz } = await loadReport(ctx, workspaceId, raw);
  const [clients, tasks, tags] = await Promise.all([
    ctx.store.list<ClientDoc>(paths.clients(workspaceId)),
    ctx.store.list<TaskDoc>(paths.tasks(workspaceId)),
    ctx.store.list<TagDoc>(paths.tags(workspaceId)),
  ]);
  const names = (rows: { id: Id; name: string }[]) => new Map(rows.map((row) => [row.id, row.name]));
  const projectNames = names(projects);
  const clientNames = names(clients);
  const taskNames = names(tasks);
  const tagNames = names(tags);
  const users = new Map(members.map((member) => [member.userId, member]));
  const separator = locale === 'pt-BR' ? ';' : ',';

  const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const yes = locale === 'pt-BR' ? 'Sim' : 'Yes';
  const no = locale === 'pt-BR' ? 'Não' : 'No';
  const money = (value: number) =>
    value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

  const lines = [HEADERS[locale].join(separator)];
  for (const entry of [...entries].reverse()) {
    const user = users.get(entry.userId);
    const stop = entry.stop ?? ctx.now().toISOString();
    const cells = [
      user?.name ?? '',
      user?.email ?? '',
      entry.clientId ? (clientNames.get(entry.clientId) ?? '') : '',
      entry.projectId ? (projectNames.get(entry.projectId) ?? '') : '',
      entry.taskId ? (taskNames.get(entry.taskId) ?? '') : '',
      entry.description,
      entry.billable ? yes : no,
      dateFormat.format(new Date(entry.start)),
      timeFormat.format(new Date(entry.start)),
      dateFormat.format(new Date(stop)),
      timeFormat.format(new Date(stop)),
      formatClock(entry.seconds),
      entry.tagIds.map((id) => tagNames.get(id) ?? '').filter(Boolean).join(', '),
      money(entry.amount),
    ];
    lines.push(cells.map((cell) => escapeCell(cell, separator)).join(separator));
  }
  // BOM para o Excel reconhecer UTF-8 e mostrar acentos corretamente.
  return `${String.fromCharCode(0xfeff)}${lines.join('\r\n')}\r\n`;
}
