// Exportação do relatório detalhado em CSV, com as mesmas colunas do export do Toggl.
// Usa ponto e vírgula em pt-BR porque o Excel brasileiro trata vírgula como decimal.
import { formatClock, type Locale, type ReportQuery, type Workspace } from '@ott/shared';
import type { Db } from '../../db/database';
import { loadReportEntries } from './service';

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

export function buildDetailedCsv(db: Db, workspace: Workspace, query: ReportQuery, locale: Locale): string {
  const entries = loadReportEntries(db, workspace, query);
  const separator = locale === 'pt-BR' ? ';' : ',';
  const names = <T extends { id: number; name: string }>(rows: T[]) => new Map(rows.map((row) => [row.id, row.name]));
  const users = new Map(
    db
      .all<{ id: number; name: string; email: string }>(
        `SELECT u.id, u.name, u.email FROM users u
         JOIN workspace_members m ON m.user_id = u.id WHERE m.workspace_id = ?`,
        workspace.id,
      )
      .map((row) => [row.id, row]),
  );
  const projects = names(db.all<{ id: number; name: string }>('SELECT id, name FROM projects WHERE workspace_id = ?', workspace.id));
  const clients = names(db.all<{ id: number; name: string }>('SELECT id, name FROM clients WHERE workspace_id = ?', workspace.id));
  const tasks = names(db.all<{ id: number; name: string }>('SELECT id, name FROM tasks WHERE workspace_id = ?', workspace.id));
  const tags = names(db.all<{ id: number; name: string }>('SELECT id, name FROM tags WHERE workspace_id = ?', workspace.id));

  const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: query.tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: query.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const yes = locale === 'pt-BR' ? 'Sim' : 'Yes';
  const no = locale === 'pt-BR' ? 'Não' : 'No';
  const money = (value: number) =>
    value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

  const lines = [HEADERS[locale].join(separator)];
  for (const entry of [...entries].reverse()) {
    const user = users.get(entry.userId);
    const stop = entry.stop ?? new Date().toISOString();
    const cells = [
      user?.name ?? '',
      user?.email ?? '',
      entry.clientId ? (clients.get(entry.clientId) ?? '') : '',
      entry.projectId ? (projects.get(entry.projectId) ?? '') : '',
      entry.taskId ? (tasks.get(entry.taskId) ?? '') : '',
      entry.description,
      entry.billable ? yes : no,
      dateFormat.format(new Date(entry.start)),
      timeFormat.format(new Date(entry.start)),
      dateFormat.format(new Date(stop)),
      timeFormat.format(new Date(stop)),
      formatClock(entry.seconds),
      entry.tagIds.map((id) => tags.get(id) ?? '').filter(Boolean).join(', '),
      money(entry.amount),
    ];
    lines.push(cells.map((cell) => escapeCell(cell, separator)).join(separator));
  }
  // BOM para o Excel reconhecer UTF-8 e mostrar acentos corretamente.
  return `${String.fromCharCode(0xfeff)}${lines.join('\r\n')}\r\n`;
}
