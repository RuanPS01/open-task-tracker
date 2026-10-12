import {
  DEFAULT_WEEKLY_CAPACITY_HOURS,
  type Currency,
  type MemberRole,
  type UpdateWorkspaceInput,
  type Workspace,
} from '@ott/shared';
import { bool, nowIso, type Db } from '../../db/database';

interface WorkspaceRow {
  id: number;
  name: string;
  currency: string;
  default_hourly_rate: number | null;
  working_days: string;
  auto_schedule: number;
  created_at: string;
  role: MemberRole;
}

function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency as Currency,
    defaultHourlyRate: row.default_hourly_rate,
    workingDays: row.working_days
      .split(',')
      .filter(Boolean)
      .map(Number)
      .sort((a, b) => a - b),
    autoSchedule: row.auto_schedule === 1,
    role: row.role,
    createdAt: row.created_at,
  };
}

const SELECT = `SELECT w.*, m.role FROM workspaces w
  JOIN workspace_members m ON m.workspace_id = w.id`;

export function listWorkspacesForUser(db: Db, userId: number): Workspace[] {
  return db
    .all<WorkspaceRow>(`${SELECT} WHERE m.user_id = ? AND m.active = 1 ORDER BY w.name`, userId)
    .map(toWorkspace);
}

export function getWorkspaceForUser(db: Db, workspaceId: number, userId: number): Workspace | null {
  const row = db.get<WorkspaceRow>(
    `${SELECT} WHERE w.id = ? AND m.user_id = ? AND m.active = 1`,
    workspaceId,
    userId,
  );
  return row ? toWorkspace(row) : null;
}

export function insertWorkspace(db: Db, name: string, ownerId: number): number {
  return db.transaction(() => {
    const now = nowIso();
    const { lastInsertRowid } = db.run(
      'INSERT INTO workspaces (name, created_at) VALUES (?, ?)',
      name,
      now,
    );
    db.run(
      `INSERT INTO workspace_members (workspace_id, user_id, role, weekly_capacity_hours, joined_at)
       VALUES (?, ?, 'admin', ?, ?)`,
      lastInsertRowid,
      ownerId,
      DEFAULT_WEEKLY_CAPACITY_HOURS,
      now,
    );
    return lastInsertRowid;
  });
}

export function updateWorkspace(db: Db, id: number, input: UpdateWorkspaceInput): void {
  if (input.name !== undefined) db.run('UPDATE workspaces SET name = ? WHERE id = ?', input.name, id);
  if (input.currency !== undefined) {
    db.run('UPDATE workspaces SET currency = ? WHERE id = ?', input.currency, id);
  }
  if (input.defaultHourlyRate !== undefined) {
    db.run('UPDATE workspaces SET default_hourly_rate = ? WHERE id = ?', input.defaultHourlyRate, id);
  }
  if (input.workingDays !== undefined) {
    const days = [...input.workingDays].sort((a, b) => a - b).join(',');
    db.run('UPDATE workspaces SET working_days = ? WHERE id = ?', days, id);
  }
  if (input.autoSchedule !== undefined) {
    db.run('UPDATE workspaces SET auto_schedule = ? WHERE id = ?', bool(input.autoSchedule), id);
  }
}
