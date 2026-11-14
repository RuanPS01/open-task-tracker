import type { Task } from '@ott/shared';
import { describe, expect, it } from 'vitest';
import { draftFrom, hasChanges, mergeChanges, withoutSaved, withoutStatus } from './taskDraft';

const task: Task = {
  id: 't1',
  workspaceId: 'w',
  projectId: 'p',
  parentId: null,
  name: 'Layout',
  description: '',
  notes: '',
  status: 'todo',
  statusId: null,
  priority: 0,
  startDate: '2026-10-12',
  dueDate: '2026-10-14',
  estimateSeconds: null,
  estimateMode: 'total',
  progress: 0,
  isMilestone: false,
  allowNonWorkingDays: false,
  billable: false,
  position: 1,
  boardPosition: null,
  assigneeIds: ['ana'],
  tagIds: [],
  trackedSeconds: 0,
  createdBy: 'ana',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  completedAt: null,
};

describe('rascunho da edição de tarefa', () => {
  const base = draftFrom(task);

  it('guarda só o que difere da tarefa e esquece o que voltou ao valor original', () => {
    let changes = mergeChanges(base, {}, { name: 'Layout novo', priority: 2 });
    expect(changes).toEqual({ name: 'Layout novo', priority: 2 });
    changes = mergeChanges(base, changes, { priority: 0 });
    expect(changes).toEqual({ name: 'Layout novo' });
    changes = mergeChanges(base, changes, { assigneeIds: ['ana'] });
    expect(changes).toEqual({ name: 'Layout novo' });
    changes = mergeChanges(base, changes, { name: 'Layout' });
    expect(hasChanges(changes)).toBe(false);
  });

  it('compara listas pelo conteúdo', () => {
    expect(mergeChanges(base, {}, { assigneeIds: ['ana', 'bruno'] })).toEqual({ assigneeIds: ['ana', 'bruno'] });
  });

  it('depois de salvar mantém o que mudou enquanto gravava', () => {
    const saved = { name: 'A', priority: 2 } as const;
    expect(withoutSaved({ name: 'A', priority: 3, notes: 'x' }, saved)).toEqual({ priority: 3, notes: 'x' });
  });

  it('concluir pelo cabeçalho tira o status do rascunho', () => {
    expect(withoutStatus({ status: 'done', statusId: null, progress: 50, name: 'B' })).toEqual({ name: 'B' });
  });
});
