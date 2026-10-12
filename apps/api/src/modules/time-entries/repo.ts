import type { TimeEntry } from '@ott/shared';
import { bool, idList, nowIso, type Db, type SqlParam } from '../../db/database';

export interface TimeEntryRow {
  id: number;
  workspace_id: number;
  user_id: number;
  project_id: number | null;
  task_id: number | null;
  description: string;
  start: string;
  stop: string | null;
  billable: number;
  created_at: string;
  updated_at: string;
  tag_ids: string | null;
}

export function entrySeconds(start: string, stop: string | null, now = Date.now()): number {
  const end = stop ? Date.parse(stop) : now;
  return Math.max(0, Math.round((end - Date.parse(start)) / 1000));
}

export const toTimeEntry = (row: TimeEntryRow): TimeEntry => ({
  id: row.id,
  workspaceId: row.workspace_id,
  userId: row.user_id,
  projectId: row.project_id,
  taskId: row.task_id,
  description: row.description,
  start: row.start,
  stop: row.stop,
  duration: entrySeconds(row.start, row.stop),
  billable: row.billable === 1,
  tagIds: idList(row.tag_ids),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const SELECT_ENTRY = `SELECT te.*,
  (SELECT GROUP_CONCAT(tag_id) FROM time_entry_tags WHERE time_entry_id = te.id) AS tag_ids
  FROM time_entries te`;

/** Apontamentos que tocam o intervalo [from, to): inclui o que está rodando. */
export function listTimeEntries(
  db: Db,
  workspaceId: number,
  userId: number,
  from: string,
  to: string,
): TimeEntry[] {
  return db
    .all<TimeEntryRow>(
      `${SELECT_ENTRY}
       WHERE te.workspace_id = ? AND te.user_id = ? AND te.start < ?
         AND (te.stop IS NULL OR te.stop > ?)
       ORDER BY te.start DESC`,
      workspaceId,
      userId,
      to,
      from,
    )
    .map(toTimeEntry);
}

export function getTimeEntry(db: Db, workspaceId: number, id: number): TimeEntry | null {
  const row = db.get<TimeEntryRow>(`${SELECT_ENTRY} WHERE te.workspace_id = ? AND te.id = ?`, workspaceId, id);
  return row ? toTimeEntry(row) : null;
}

export function getRunningEntry(db: Db, userId: number): TimeEntry | null {
  const row = db.get<TimeEntryRow>(`${SELECT_ENTRY} WHERE te.user_id = ? AND te.stop IS NULL`, userId);
  return row ? toTimeEntry(row) : null;
}

export interface TimeEntryRecord {
  projectId: number | null;
  taskId: number | null;
  description: string;
  start: string;
  stop: string | null;
  billable: boolean;
}

const COLUMNS: Record<keyof TimeEntryRecord, string> = {
  projectId: 'project_id',
  taskId: 'task_id',
  description: 'description',
  start: 'start',
  stop: 'stop',
  billable: 'billable',
};

export function insertTimeEntry(db: Db, workspaceId: number, userId: number, record: TimeEntryRecord): number {
  const now = nowIso();
  return db.run(
    `INSERT INTO time_entries (workspace_id, user_id, project_id, task_id, description, start, stop,
       billable, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    workspaceId,
    userId,
    record.projectId,
    record.taskId,
    record.description,
    record.start,
    record.stop,
    bool(record.billable),
    now,
    now,
  ).lastInsertRowid;
}

export function updateTimeEntryRecord(db: Db, id: number, changes: Partial<TimeEntryRecord>): void {
  const entries = Object.entries(changes).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;
  db.run(
    `UPDATE time_entries SET ${entries.map(([key]) => `${COLUMNS[key as keyof TimeEntryRecord]} = ?`).join(', ')},
       updated_at = ? WHERE id = ?`,
    ...entries.map(([, value]) => (typeof value === 'boolean' ? bool(value) : (value as SqlParam))),
    nowIso(),
    id,
  );
}

export function setTimeEntryTags(db: Db, entryId: number, tagIds: number[]): void {
  db.run('DELETE FROM time_entry_tags WHERE time_entry_id = ?', entryId);
  for (const tagId of new Set(tagIds)) {
    db.run('INSERT INTO time_entry_tags (time_entry_id, tag_id) VALUES (?, ?)', entryId, tagId);
  }
}

export function deleteTimeEntry(db: Db, id: number): void {
  db.run('DELETE FROM time_entries WHERE id = ?', id);
}
