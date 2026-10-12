import type { CreateProjectInput, Project, UpdateProjectInput } from '@ott/shared';
import { bool, idList, nowIso, type Db, type SqlParam } from '../../db/database';

interface ProjectRow {
  id: number;
  workspace_id: number;
  client_id: number | null;
  name: string;
  color: string;
  billable: number;
  estimate_seconds: number | null;
  hourly_rate: number | null;
  start_date: string | null;
  end_date: string | null;
  archived: number;
  created_at: string;
  pinned: number;
  tracked_seconds: number | null;
  task_count: number;
  done_task_count: number;
  member_ids: string | null;
}

const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  workspaceId: row.workspace_id,
  clientId: row.client_id,
  name: row.name,
  color: row.color,
  billable: row.billable === 1,
  estimateSeconds: row.estimate_seconds,
  hourlyRate: row.hourly_rate,
  startDate: row.start_date,
  endDate: row.end_date,
  archived: row.archived === 1,
  pinned: row.pinned === 1,
  trackedSeconds: Math.round(row.tracked_seconds ?? 0),
  taskCount: row.task_count,
  doneTaskCount: row.done_task_count,
  memberIds: idList(row.member_ids),
  createdAt: row.created_at,
});

// Duração em segundos de um apontamento; o que está rodando conta até agora.
export const ENTRY_SECONDS_SQL = `(julianday(COALESCE(te.stop, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))) - julianday(te.start)) * 86400`;

const SELECT = `SELECT p.*,
  EXISTS (SELECT 1 FROM project_pins pp WHERE pp.project_id = p.id AND pp.user_id = ?) AS pinned,
  (SELECT SUM(${ENTRY_SECONDS_SQL}) FROM time_entries te WHERE te.project_id = p.id) AS tracked_seconds,
  (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
  (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_task_count,
  (SELECT GROUP_CONCAT(user_id) FROM (
     SELECT te.user_id FROM time_entries te WHERE te.project_id = p.id
     UNION
     SELECT ta.user_id FROM task_assignees ta JOIN tasks t ON t.id = ta.task_id WHERE t.project_id = p.id
  )) AS member_ids
  FROM projects p`;

export function listProjects(db: Db, workspaceId: number, userId: number): Project[] {
  return db
    .all<ProjectRow>(`${SELECT} WHERE p.workspace_id = ? ORDER BY p.name COLLATE NOCASE`, userId, workspaceId)
    .map(toProject);
}

export function getProject(db: Db, workspaceId: number, id: number, userId: number): Project | null {
  const row = db.get<ProjectRow>(`${SELECT} WHERE p.workspace_id = ? AND p.id = ?`, userId, workspaceId, id);
  return row ? toProject(row) : null;
}

export function projectExists(db: Db, workspaceId: number, id: number): boolean {
  return db.get('SELECT 1 FROM projects WHERE workspace_id = ? AND id = ?', workspaceId, id) !== undefined;
}

export function insertProject(db: Db, workspaceId: number, input: CreateProjectInput): number {
  const now = nowIso();
  return db.run(
    `INSERT INTO projects (workspace_id, client_id, name, color, billable, estimate_seconds,
       hourly_rate, start_date, end_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    workspaceId,
    input.clientId ?? null,
    input.name,
    input.color,
    bool(input.billable ?? false),
    input.estimateSeconds ?? null,
    input.hourlyRate ?? null,
    input.startDate ?? null,
    input.endDate ?? null,
    now,
    now,
  ).lastInsertRowid;
}

const COLUMNS: Record<string, string> = {
  name: 'name',
  color: 'color',
  clientId: 'client_id',
  billable: 'billable',
  estimateSeconds: 'estimate_seconds',
  hourlyRate: 'hourly_rate',
  startDate: 'start_date',
  endDate: 'end_date',
  archived: 'archived',
};

export function updateProject(
  db: Db,
  workspaceId: number,
  id: number,
  userId: number,
  input: UpdateProjectInput,
): void {
  const sets: string[] = [];
  const params: SqlParam[] = [];
  for (const [key, column] of Object.entries(COLUMNS)) {
    const value = (input as Record<string, unknown>)[key];
    if (value === undefined) continue;
    sets.push(`${column} = ?`);
    params.push(typeof value === 'boolean' ? bool(value) : (value as SqlParam));
  }
  db.transaction(() => {
    if (sets.length > 0) {
      db.run(
        `UPDATE projects SET ${sets.join(', ')}, updated_at = ? WHERE id = ? AND workspace_id = ?`,
        ...params,
        nowIso(),
        id,
        workspaceId,
      );
    }
    if (input.pinned === true) {
      db.run('INSERT OR IGNORE INTO project_pins (user_id, project_id) VALUES (?, ?)', userId, id);
    } else if (input.pinned === false) {
      db.run('DELETE FROM project_pins WHERE user_id = ? AND project_id = ?', userId, id);
    }
  });
}

export function deleteProject(db: Db, workspaceId: number, id: number): void {
  db.run('DELETE FROM projects WHERE id = ? AND workspace_id = ?', id, workspaceId);
}
