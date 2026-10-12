import type {
  DependencyType,
  EstimateMode,
  Priority,
  Task,
  TaskDependency,
  TaskStatus,
} from '@ott/shared';
import { idList, nowIso, type Db, type SqlParam } from '../../db/database';
import { ENTRY_SECONDS_SQL } from '../projects/repo';

interface TaskRow {
  id: number;
  workspace_id: number;
  project_id: number | null;
  parent_id: number | null;
  name: string;
  description: string;
  notes: string;
  status: TaskStatus;
  priority: number;
  start_date: string | null;
  due_date: string | null;
  estimate_seconds: number | null;
  estimate_mode: EstimateMode;
  progress: number;
  is_milestone: number;
  allow_non_working_days: number;
  billable: number;
  position: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  assignee_ids: string | null;
  tag_ids: string | null;
  tracked_seconds: number | null;
}

const toTask = (row: TaskRow): Task => ({
  id: row.id,
  workspaceId: row.workspace_id,
  projectId: row.project_id,
  parentId: row.parent_id,
  name: row.name,
  description: row.description,
  notes: row.notes,
  status: row.status,
  priority: row.priority as Priority,
  startDate: row.start_date,
  dueDate: row.due_date,
  estimateSeconds: row.estimate_seconds,
  estimateMode: row.estimate_mode,
  progress: row.progress,
  isMilestone: row.is_milestone === 1,
  allowNonWorkingDays: row.allow_non_working_days === 1,
  billable: row.billable === 1,
  position: row.position,
  assigneeIds: idList(row.assignee_ids),
  tagIds: idList(row.tag_ids),
  trackedSeconds: Math.round(row.tracked_seconds ?? 0),
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at,
});

const SELECT = `SELECT t.*,
  (SELECT GROUP_CONCAT(user_id) FROM task_assignees WHERE task_id = t.id) AS assignee_ids,
  (SELECT GROUP_CONCAT(tag_id) FROM task_tags WHERE task_id = t.id) AS tag_ids,
  (SELECT SUM(${ENTRY_SECONDS_SQL}) FROM time_entries te WHERE te.task_id = t.id) AS tracked_seconds
  FROM tasks t`;

export interface TaskFilters {
  projectId?: number;
  assigneeId?: number;
}

export function listTasks(db: Db, workspaceId: number, filters: TaskFilters = {}): Task[] {
  const where = ['t.workspace_id = ?'];
  const params: SqlParam[] = [workspaceId];
  if (filters.projectId !== undefined) {
    where.push('t.project_id = ?');
    params.push(filters.projectId);
  }
  if (filters.assigneeId !== undefined) {
    where.push('EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND a.user_id = ?)');
    params.push(filters.assigneeId);
  }
  return db
    .all<TaskRow>(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY t.position, t.id`, ...params)
    .map(toTask);
}

export function getTask(db: Db, workspaceId: number, id: number): Task | null {
  const row = db.get<TaskRow>(`${SELECT} WHERE t.workspace_id = ? AND t.id = ?`, workspaceId, id);
  return row ? toTask(row) : null;
}

export function getTasksByIds(db: Db, workspaceId: number, ids: number[]): Task[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  return db
    .all<TaskRow>(`${SELECT} WHERE t.workspace_id = ? AND t.id IN (${placeholders})`, workspaceId, ...ids)
    .map(toTask);
}

/** Campos mínimos de todas as tarefas do workspace, para agendamento. */
export interface ScheduleRow {
  id: number;
  parent_id: number | null;
  start_date: string | null;
  due_date: string | null;
  is_milestone: number;
  allow_non_working_days: number;
  progress: number;
  status: TaskStatus;
}

export function listScheduleRows(db: Db, workspaceId: number): ScheduleRow[] {
  return db.all<ScheduleRow>(
    'SELECT id, parent_id, start_date, due_date, is_milestone, allow_non_working_days, progress, status FROM tasks WHERE workspace_id = ?',
    workspaceId,
  );
}

export function nextPosition(db: Db, workspaceId: number, parentId: number | null): number {
  const row = db.get<{ max: number | null }>(
    'SELECT MAX(position) AS max FROM tasks WHERE workspace_id = ? AND parent_id IS ?',
    workspaceId,
    parentId,
  );
  return (row?.max ?? 0) + 1;
}

export interface TaskRecord {
  projectId: number | null;
  parentId: number | null;
  name: string;
  description: string;
  notes: string;
  status: TaskStatus;
  priority: number;
  startDate: string | null;
  dueDate: string | null;
  estimateSeconds: number | null;
  estimateMode: EstimateMode;
  progress: number;
  isMilestone: boolean;
  allowNonWorkingDays: boolean;
  billable: boolean;
  position: number;
  completedAt: string | null;
}

const COLUMNS: Record<keyof TaskRecord, string> = {
  projectId: 'project_id',
  parentId: 'parent_id',
  name: 'name',
  description: 'description',
  notes: 'notes',
  status: 'status',
  priority: 'priority',
  startDate: 'start_date',
  dueDate: 'due_date',
  estimateSeconds: 'estimate_seconds',
  estimateMode: 'estimate_mode',
  progress: 'progress',
  isMilestone: 'is_milestone',
  allowNonWorkingDays: 'allow_non_working_days',
  billable: 'billable',
  position: 'position',
  completedAt: 'completed_at',
};

const toParam = (value: unknown): SqlParam =>
  typeof value === 'boolean' ? (value ? 1 : 0) : (value as SqlParam);

export function insertTask(db: Db, workspaceId: number, createdBy: number, record: TaskRecord): number {
  const keys = Object.keys(COLUMNS) as (keyof TaskRecord)[];
  const now = nowIso();
  return db.run(
    `INSERT INTO tasks (workspace_id, created_by, created_at, updated_at, ${keys.map((k) => COLUMNS[k]).join(', ')})
     VALUES (?, ?, ?, ?, ${keys.map(() => '?').join(', ')})`,
    workspaceId,
    createdBy,
    now,
    now,
    ...keys.map((key) => toParam(record[key])),
  ).lastInsertRowid;
}

export function updateTaskRecord(
  db: Db,
  workspaceId: number,
  id: number,
  changes: Partial<TaskRecord>,
): void {
  const entries = Object.entries(changes).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;
  db.run(
    `UPDATE tasks SET ${entries.map(([key]) => `${COLUMNS[key as keyof TaskRecord]} = ?`).join(', ')},
       updated_at = ? WHERE id = ? AND workspace_id = ?`,
    ...entries.map(([, value]) => toParam(value)),
    nowIso(),
    id,
    workspaceId,
  );
}

export function setTaskAssignees(db: Db, taskId: number, userIds: number[]): void {
  db.run('DELETE FROM task_assignees WHERE task_id = ?', taskId);
  for (const userId of new Set(userIds)) {
    db.run('INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)', taskId, userId);
  }
}

export function setTaskTags(db: Db, taskId: number, tagIds: number[]): void {
  db.run('DELETE FROM task_tags WHERE task_id = ?', taskId);
  for (const tagId of new Set(tagIds)) {
    db.run('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', taskId, tagId);
  }
}

export function deleteTask(db: Db, workspaceId: number, id: number): void {
  db.run('DELETE FROM tasks WHERE id = ? AND workspace_id = ?', id, workspaceId);
}

/** Subtarefas herdam o projeto da mãe; mover a mãe de projeto leva a árvore junto. */
export function setProjectForDescendants(db: Db, workspaceId: number, rootId: number, projectId: number | null): void {
  db.run(
    `WITH RECURSIVE tree(id) AS (
       SELECT id FROM tasks WHERE parent_id = ? AND workspace_id = ?
       UNION ALL
       SELECT t.id FROM tasks t JOIN tree ON t.parent_id = tree.id
     )
     UPDATE tasks SET project_id = ?, updated_at = ? WHERE id IN (SELECT id FROM tree)`,
    rootId,
    workspaceId,
    projectId,
    nowIso(),
  );
}

// --- Dependências ----------------------------------------------------------

interface DependencyRow {
  id: number;
  workspace_id: number;
  predecessor_id: number;
  successor_id: number;
  type: DependencyType;
  lag_days: number;
}

const toDependency = (row: DependencyRow): TaskDependency => ({
  id: row.id,
  workspaceId: row.workspace_id,
  predecessorId: row.predecessor_id,
  successorId: row.successor_id,
  type: row.type,
  lagDays: row.lag_days,
});

export function listDependencies(db: Db, workspaceId: number, projectId?: number): TaskDependency[] {
  if (projectId === undefined) {
    return db
      .all<DependencyRow>('SELECT * FROM task_dependencies WHERE workspace_id = ? ORDER BY id', workspaceId)
      .map(toDependency);
  }
  // Inclui ligações que entram ou saem do projeto, para o Gantt desenhar as duas pontas.
  return db
    .all<DependencyRow>(
      `SELECT d.* FROM task_dependencies d
       JOIN tasks p ON p.id = d.predecessor_id
       JOIN tasks s ON s.id = d.successor_id
       WHERE d.workspace_id = ? AND (p.project_id = ? OR s.project_id = ?)
       ORDER BY d.id`,
      workspaceId,
      projectId,
      projectId,
    )
    .map(toDependency);
}

export function getDependency(db: Db, workspaceId: number, id: number): TaskDependency | null {
  const row = db.get<DependencyRow>(
    'SELECT * FROM task_dependencies WHERE workspace_id = ? AND id = ?',
    workspaceId,
    id,
  );
  return row ? toDependency(row) : null;
}

export function insertDependency(
  db: Db,
  workspaceId: number,
  input: { predecessorId: number; successorId: number; type: DependencyType; lagDays: number },
): number {
  return db.run(
    `INSERT INTO task_dependencies (workspace_id, predecessor_id, successor_id, type, lag_days, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    workspaceId,
    input.predecessorId,
    input.successorId,
    input.type,
    input.lagDays,
    nowIso(),
  ).lastInsertRowid;
}

export function updateDependency(
  db: Db,
  workspaceId: number,
  id: number,
  input: { type?: DependencyType; lagDays?: number },
): void {
  if (input.type !== undefined) {
    db.run('UPDATE task_dependencies SET type = ? WHERE id = ? AND workspace_id = ?', input.type, id, workspaceId);
  }
  if (input.lagDays !== undefined) {
    db.run(
      'UPDATE task_dependencies SET lag_days = ? WHERE id = ? AND workspace_id = ?',
      input.lagDays,
      id,
      workspaceId,
    );
  }
}

export function deleteDependency(db: Db, workspaceId: number, id: number): void {
  db.run('DELETE FROM task_dependencies WHERE id = ? AND workspace_id = ?', id, workspaceId);
}
