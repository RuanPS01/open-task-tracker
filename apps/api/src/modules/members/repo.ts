import type { Member, MemberRole, UpdateMemberInput } from '@ott/shared';
import { bool, nowIso, type Db } from '../../db/database';

interface MemberRow {
  user_id: number;
  workspace_id: number;
  name: string;
  email: string;
  avatar_color: string;
  role: MemberRole;
  weekly_capacity_hours: number;
  hourly_rate: number | null;
  active: number;
  joined_at: string;
}

function toMember(row: MemberRow): Member {
  return {
    userId: row.user_id,
    workspaceId: row.workspace_id,
    name: row.name,
    email: row.email,
    avatarColor: row.avatar_color,
    role: row.role,
    weeklyCapacityHours: row.weekly_capacity_hours,
    hourlyRate: row.hourly_rate,
    active: row.active === 1,
    joinedAt: row.joined_at,
  };
}

const SELECT = `SELECT m.*, u.name, u.email, u.avatar_color
  FROM workspace_members m JOIN users u ON u.id = m.user_id`;

export function listMembers(db: Db, workspaceId: number): Member[] {
  return db
    .all<MemberRow>(`${SELECT} WHERE m.workspace_id = ? ORDER BY u.name COLLATE NOCASE`, workspaceId)
    .map(toMember);
}

export function getMember(db: Db, workspaceId: number, userId: number): Member | null {
  const row = db.get<MemberRow>(`${SELECT} WHERE m.workspace_id = ? AND m.user_id = ?`, workspaceId, userId);
  return row ? toMember(row) : null;
}

export function insertMember(
  db: Db,
  input: {
    workspaceId: number;
    userId: number;
    role: MemberRole;
    weeklyCapacityHours: number;
    hourlyRate: number | null;
  },
): void {
  db.run(
    `INSERT INTO workspace_members
       (workspace_id, user_id, role, weekly_capacity_hours, hourly_rate, active, joined_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    input.workspaceId,
    input.userId,
    input.role,
    input.weeklyCapacityHours,
    input.hourlyRate,
    nowIso(),
  );
}

export function updateMember(db: Db, workspaceId: number, userId: number, input: UpdateMemberInput): void {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  if (input.role !== undefined) {
    sets.push('role = ?');
    params.push(input.role);
  }
  if (input.weeklyCapacityHours !== undefined) {
    sets.push('weekly_capacity_hours = ?');
    params.push(input.weeklyCapacityHours);
  }
  if (input.hourlyRate !== undefined) {
    sets.push('hourly_rate = ?');
    params.push(input.hourlyRate);
  }
  if (input.active !== undefined) {
    sets.push('active = ?');
    params.push(bool(input.active));
  }
  if (sets.length === 0) return;
  db.run(
    `UPDATE workspace_members SET ${sets.join(', ')} WHERE workspace_id = ? AND user_id = ?`,
    ...params,
    workspaceId,
    userId,
  );
}

export function deleteMember(db: Db, workspaceId: number, userId: number): void {
  db.transaction(() => {
    db.run(
      `DELETE FROM task_assignees WHERE user_id = ?
         AND task_id IN (SELECT id FROM tasks WHERE workspace_id = ?)`,
      userId,
      workspaceId,
    );
    db.run('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?', workspaceId, userId);
    db.run(
      'UPDATE users SET current_workspace_id = NULL WHERE id = ? AND current_workspace_id = ?',
      userId,
      workspaceId,
    );
  });
}

export function countActiveAdmins(db: Db, workspaceId: number): number {
  return (
    db.get<{ total: number }>(
      `SELECT COUNT(*) AS total FROM workspace_members
       WHERE workspace_id = ? AND role = 'admin' AND active = 1`,
      workspaceId,
    )?.total ?? 0
  );
}

export function memberIdsOf(db: Db, workspaceId: number): Set<number> {
  return new Set(
    db
      .all<{ user_id: number }>('SELECT user_id FROM workspace_members WHERE workspace_id = ?', workspaceId)
      .map((row) => row.user_id),
  );
}
