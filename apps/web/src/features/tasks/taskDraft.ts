// Rascunho da edição de uma tarefa existente: o painel guarda só os campos alterados
// (`changes`) por cima da tarefa como está no cache, e grava tudo de uma vez no botão
// Salvar. Guardar só a diferença deixa o resto da tarefa acompanhar o que muda fora do
// painel (cascata, status da mãe, outra aba) enquanto a pessoa edita.
import type { Task } from '@ott/shared';
import type { TaskDraft } from './TaskFields';

export function draftFrom(task: Task): TaskDraft {
  return {
    name: task.name,
    description: task.description,
    notes: task.notes,
    projectId: task.projectId,
    parentId: task.parentId,
    startDate: task.startDate,
    dueDate: task.dueDate,
    estimateSeconds: task.estimateSeconds,
    estimateMode: task.estimateMode,
    priority: task.priority,
    tagIds: task.tagIds,
    assigneeIds: task.assigneeIds,
    status: task.status,
    statusId: task.statusId,
    billable: task.billable,
    isMilestone: task.isMilestone,
    allowNonWorkingDays: task.allowNonWorkingDays,
    progress: task.progress,
  };
}

const sameValue = (a: unknown, b: unknown) =>
  Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((item, index) => item === b[index]) : a === b;

/**
 * Junta uma alteração ao rascunho e tira o que voltou a ser igual à tarefa, para que
 * desfazer à mão (escolher de novo a data antiga) não deixe o painel "com alterações".
 */
export function mergeChanges(base: TaskDraft, changes: Partial<TaskDraft>, change: Partial<TaskDraft>): Partial<TaskDraft> {
  const next: Partial<TaskDraft> = { ...changes, ...change };
  for (const key of Object.keys(next) as (keyof TaskDraft)[]) {
    if (sameValue(next[key], base[key])) delete next[key];
  }
  return next;
}

/** Depois de salvar: sai do rascunho o que foi gravado; o que mudou enquanto gravava fica. */
export function withoutSaved(changes: Partial<TaskDraft>, saved: Partial<TaskDraft>): Partial<TaskDraft> {
  const next: Partial<TaskDraft> = { ...changes };
  for (const key of Object.keys(saved) as (keyof TaskDraft)[]) {
    if (sameValue(next[key], saved[key])) delete next[key];
  }
  return next;
}

/** Campos do status que o botão de concluir do cabeçalho grava na hora. */
export function withoutStatus(changes: Partial<TaskDraft>): Partial<TaskDraft> {
  const { status: _status, statusId: _statusId, progress: _progress, ...rest } = changes;
  return rest;
}

export const hasChanges = (changes: Partial<TaskDraft>) => Object.keys(changes).length > 0;
