// Regras do cronômetro e dos apontamentos, espelhando o Toggl Track:
// - um único cronômetro rodando por pessoa (iniciar outro para o anterior);
// - apontamento ligado a tarefa herda o projeto da tarefa;
// - sem "faturável" explícito, herda do projeto.
import {
  MAX_TIME_ENTRY_SECONDS,
  type CreateTimeEntryInput,
  type StartTimerInput,
  type TimeEntry,
  type UpdateTimeEntryInput,
  type Workspace,
} from '@ott/shared';
import { nowIso, type Db } from '../../db/database';
import { badRequest, forbidden, notFound } from '../../http/errors';
import { getTask } from '../tasks/repo';
import { tagIdsOf } from '../tags/repo';
import {
  deleteTimeEntry,
  getRunningEntry,
  getTimeEntry,
  insertTimeEntry,
  setTimeEntryTags,
  updateTimeEntryRecord,
  type TimeEntryRecord,
} from './repo';

interface Links {
  projectId: number | null;
  taskId: number | null;
}

function resolveLinks(db: Db, workspaceId: number, projectId: number | null, taskId: number | null): Links {
  if (taskId !== null) {
    const task = getTask(db, workspaceId, taskId);
    if (!task) throw notFound('Tarefa');
    return { projectId: task.projectId, taskId };
  }
  if (projectId !== null) {
    const exists = db.get('SELECT 1 FROM projects WHERE id = ? AND workspace_id = ?', projectId, workspaceId);
    if (!exists) throw notFound('Projeto');
  }
  return { projectId, taskId: null };
}

function defaultBillable(db: Db, projectId: number | null): boolean {
  if (projectId === null) return false;
  return db.get<{ billable: number }>('SELECT billable FROM projects WHERE id = ?', projectId)?.billable === 1;
}

function checkTags(db: Db, workspaceId: number, tagIds: number[] | undefined): void {
  if (!tagIds || tagIds.length === 0) return;
  const known = tagIdsOf(db, workspaceId);
  if (tagIds.some((id) => !known.has(id))) throw notFound('Tag');
}

function checkRange(start: string, stop: string | null): void {
  if (stop === null) return;
  const seconds = (Date.parse(stop) - Date.parse(start)) / 1000;
  if (seconds < 0) throw badRequest('INVALID_RANGE', 'O fim é anterior ao início');
  if (seconds > MAX_TIME_ENTRY_SECONDS) throw badRequest('INVALID_RANGE', 'Duração acima do limite');
}

/** Normaliza qualquer ISO com fuso para o formato UTC usado no banco (comparável como texto). */
const toUtc = (iso: string) => new Date(iso).toISOString();

export function stopRunningEntry(db: Db, userId: number, at = nowIso()): TimeEntry | null {
  const running = getRunningEntry(db, userId);
  if (!running) return null;
  // Se o relógio do cliente adiantou o início, não gravamos duração negativa.
  const stop = at < running.start ? running.start : at;
  updateTimeEntryRecord(db, running.id, { stop });
  return getTimeEntry(db, running.workspaceId, running.id);
}

export function startTimer(db: Db, workspace: Workspace, userId: number, input: StartTimerInput): TimeEntry {
  return db.transaction(() => {
    checkTags(db, workspace.id, input.tagIds);
    const links = resolveLinks(db, workspace.id, input.projectId ?? null, input.taskId ?? null);
    const now = nowIso();
    stopRunningEntry(db, userId, now);
    const id = insertTimeEntry(db, workspace.id, userId, {
      ...links,
      description: input.description ?? '',
      start: now,
      stop: null,
      billable: input.billable ?? defaultBillable(db, links.projectId),
    });
    if (input.tagIds) setTimeEntryTags(db, id, input.tagIds);
    return getTimeEntry(db, workspace.id, id)!;
  });
}

export function createTimeEntry(
  db: Db,
  workspace: Workspace,
  userId: number,
  input: CreateTimeEntryInput,
): TimeEntry {
  return db.transaction(() => {
    checkTags(db, workspace.id, input.tagIds);
    const start = toUtc(input.start);
    const stop = toUtc(input.stop);
    checkRange(start, stop);
    const links = resolveLinks(db, workspace.id, input.projectId ?? null, input.taskId ?? null);
    const id = insertTimeEntry(db, workspace.id, userId, {
      ...links,
      description: input.description ?? '',
      start,
      stop,
      billable: input.billable ?? defaultBillable(db, links.projectId),
    });
    if (input.tagIds) setTimeEntryTags(db, id, input.tagIds);
    return getTimeEntry(db, workspace.id, id)!;
  });
}

function ownEntry(db: Db, workspace: Workspace, userId: number, id: number): TimeEntry {
  const entry = getTimeEntry(db, workspace.id, id);
  if (!entry) throw notFound('Apontamento');
  if (entry.userId !== userId) throw forbidden('Só é possível alterar os próprios apontamentos');
  return entry;
}

export function updateTimeEntry(
  db: Db,
  workspace: Workspace,
  userId: number,
  id: number,
  input: UpdateTimeEntryInput,
): TimeEntry {
  return db.transaction(() => {
    const entry = ownEntry(db, workspace, userId, id);
    checkTags(db, workspace.id, input.tagIds);
    const changes: Partial<TimeEntryRecord> = {};
    if (input.description !== undefined) changes.description = input.description;
    if (input.billable !== undefined) changes.billable = input.billable;

    if (input.taskId !== undefined || input.projectId !== undefined) {
      let taskId = input.taskId === undefined ? entry.taskId : input.taskId;
      const projectId = input.projectId === undefined ? entry.projectId : input.projectId;
      // Trocar de projeto solta a tarefa que pertencia ao projeto anterior.
      if (input.taskId === undefined && taskId !== null && projectId !== entry.projectId) taskId = null;
      Object.assign(changes, resolveLinks(db, workspace.id, projectId, taskId));
    }

    const start = input.start !== undefined ? toUtc(input.start) : entry.start;
    let stop = entry.stop;
    if (input.stop !== undefined) {
      if (input.stop === null) {
        if (entry.stop !== null) throw badRequest('INVALID_RANGE', 'Use iniciar para retomar um apontamento');
      } else {
        stop = toUtc(input.stop);
      }
    }
    if (start > nowIso() && stop === null) {
      throw badRequest('INVALID_RANGE', 'O cronômetro não pode começar no futuro');
    }
    checkRange(start, stop);
    changes.start = start;
    changes.stop = stop;

    updateTimeEntryRecord(db, id, changes);
    if (input.tagIds) setTimeEntryTags(db, id, input.tagIds);
    return getTimeEntry(db, workspace.id, id)!;
  });
}

export function stopTimeEntry(db: Db, workspace: Workspace, userId: number, id: number): TimeEntry {
  return db.transaction(() => {
    const entry = ownEntry(db, workspace, userId, id);
    if (entry.stop !== null) return entry;
    return stopRunningEntry(db, userId)!;
  });
}

export function removeTimeEntry(db: Db, workspace: Workspace, userId: number, id: number): void {
  ownEntry(db, workspace, userId, id);
  deleteTimeEntry(db, id);
}
