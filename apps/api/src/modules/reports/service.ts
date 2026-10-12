// Relatórios (resumo, detalhado e exportação CSV), calculados no servidor.
// O dia de um apontamento é o dia em que ele começou, no fuso que a web informa (tz).
// Mesmo critério do Toggl: um apontamento que atravessa a meia-noite conta no dia do início.
import {
  addDays,
  eachDay,
  type Id,
  type ReportDetailed,
  type ReportDetailedRow,
  type ReportProjectRow,
  type ReportQuery,
  type ReportSummary,
  type Workspace,
} from '@ott/shared';
import type { Db, SqlParam } from '../../db/database';
import { badRequest } from '../../http/errors';
import { entrySeconds, SELECT_ENTRY, toTimeEntry, type TimeEntryRow } from '../time-entries/repo';

interface RateContext {
  projectRate: Map<Id, number | null>;
  projectClient: Map<Id, Id | null>;
  memberRate: Map<Id, number | null>;
  workspaceRate: number | null;
}

function loadRateContext(db: Db, workspace: Workspace): RateContext {
  const projects = db.all<{ id: number; hourly_rate: number | null; client_id: number | null }>(
    'SELECT id, hourly_rate, client_id FROM projects WHERE workspace_id = ?',
    workspace.id,
  );
  const members = db.all<{ user_id: number; hourly_rate: number | null }>(
    'SELECT user_id, hourly_rate FROM workspace_members WHERE workspace_id = ?',
    workspace.id,
  );
  return {
    projectRate: new Map(projects.map((p) => [p.id, p.hourly_rate])),
    projectClient: new Map(projects.map((p) => [p.id, p.client_id])),
    memberRate: new Map(members.map((m) => [m.user_id, m.hourly_rate])),
    workspaceRate: workspace.defaultHourlyRate,
  };
}

/** Valor/hora: o do projeto vence o do membro, que vence o padrão do workspace. */
function hourlyRate(ctx: RateContext, projectId: Id | null, userId: Id): number {
  const projectRate = projectId === null ? null : (ctx.projectRate.get(projectId) ?? null);
  return projectRate ?? ctx.memberRate.get(userId) ?? ctx.workspaceRate ?? 0;
}

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

export interface FilteredEntry extends ReportDetailedRow {
  clientId: Id | null;
}

export function loadReportEntries(db: Db, workspace: Workspace, query: ReportQuery): FilteredEntry[] {
  if (query.end < query.start) throw badRequest('INVALID_RANGE', 'Fim do período antes do início');
  const toLocalDate = localDateFormatter(query.tz);
  const ctx = loadRateContext(db, workspace);

  // Filtro largo em UTC (um dia de folga de cada lado cobre qualquer fuso);
  // o corte exato é feito abaixo, já com a data local.
  const where = ['te.workspace_id = ?', 'te.start >= ?', 'te.start < ?'];
  const params: SqlParam[] = [workspace.id, `${addDays(query.start, -1)}T00:00:00.000Z`, `${addDays(query.end, 2)}T00:00:00.000Z`];
  if (query.userIds && query.userIds.length > 0) {
    where.push(`te.user_id IN (${query.userIds.map(() => '?').join(',')})`);
    params.push(...query.userIds);
  }
  const rows = db.all<TimeEntryRow>(`${SELECT_ENTRY} WHERE ${where.join(' AND ')} ORDER BY te.start DESC`, ...params);

  const now = Date.now();
  const description = query.description?.trim().toLowerCase();
  const result: FilteredEntry[] = [];
  for (const row of rows) {
    const entry = toTimeEntry(row);
    const date = toLocalDate(entry.start);
    if (date < query.start || date > query.end) continue;
    // Id 0 nos filtros significa "sem projeto" / "sem cliente" / "sem tarefa".
    const projectKey = entry.projectId ?? 0;
    if (query.projectIds && query.projectIds.length > 0 && !query.projectIds.includes(projectKey)) continue;
    const clientId = entry.projectId === null ? null : (ctx.projectClient.get(entry.projectId) ?? null);
    if (query.clientIds && query.clientIds.length > 0 && !query.clientIds.includes(clientId ?? 0)) continue;
    if (query.taskIds && query.taskIds.length > 0 && !query.taskIds.includes(entry.taskId ?? 0)) continue;
    if (query.tagIds && query.tagIds.length > 0) {
      const wantsUntagged = query.tagIds.includes(0) && entry.tagIds.length === 0;
      if (!wantsUntagged && !entry.tagIds.some((id) => query.tagIds!.includes(id))) continue;
    }
    if (query.billable !== undefined && entry.billable !== (query.billable === 'true')) continue;
    if (description && !entry.description.toLowerCase().includes(description)) continue;

    const seconds = entrySeconds(entry.start, entry.stop, now);
    const amount = entry.billable ? roundMoney((seconds / 3600) * hourlyRate(ctx, entry.projectId, entry.userId)) : 0;
    result.push({
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
  return result;
}

export function buildSummary(db: Db, workspace: Workspace, query: ReportQuery): ReportSummary {
  const entries = loadReportEntries(db, workspace, query);
  const days = new Map(eachDay(query.start, query.end).map((date) => [date, { date, seconds: 0, billableSeconds: 0 }]));
  const projects = new Map<Id | null, ReportProjectRow & { itemMap: Map<string, { description: string; taskId: Id | null; seconds: number }> }>();
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

export function buildDetailed(db: Db, workspace: Workspace, query: ReportQuery): ReportDetailed {
  const entries = loadReportEntries(db, workspace, query);
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
