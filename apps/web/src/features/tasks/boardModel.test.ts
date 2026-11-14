import type { Task } from '@ott/shared';
import { describe, expect, it } from 'vitest';
import { afterIdAt, buildBoard, dropIndex, edgeSpeed, isSamePlace } from './boardModel';

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  workspaceId: 'w',
  projectId: 'p',
  parentId: null,
  name: id,
  description: '',
  notes: '',
  status: 'todo',
  statusId: null,
  priority: 0,
  startDate: null,
  dueDate: null,
  estimateSeconds: null,
  estimateMode: 'total',
  progress: 0,
  isMilestone: false,
  allowNonWorkingDays: false,
  billable: false,
  position: 1,
  boardPosition: null,
  assigneeIds: [],
  tagIds: [],
  trackedSeconds: 0,
  createdBy: 'u',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  completedAt: null,
  ...extra,
});

describe('quadro', () => {
  const keys = ['todo', 'revisao', 'in_progress', 'done'];

  it('subtarefa com a mãe visível fica dentro do cartão; sem a mãe vira cartão', () => {
    const mae = task('mae', { status: 'in_progress' });
    const filhaA = task('a', { parentId: 'mae', position: 2, status: 'done' });
    const filhaB = task('b', { parentId: 'mae', position: 1 });
    const solta = task('solta', { parentId: 'outra' });
    const all = [mae, filhaA, filhaB, solta, task('outra')];
    const board = buildBoard([mae, filhaA, filhaB, solta], all, keys, new Set());
    expect(board.columns.get('in_progress')!.map((item) => item.id)).toEqual(['mae']);
    expect(board.columns.get('todo')!.map((item) => item.id)).toEqual(['solta']);
    expect(board.columns.get('done')).toEqual([]);
    expect(board.subtasks.get('mae')!.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('ordena pela posição do quadro e põe status customizado excluído na coluna padrão', () => {
    const tasks = [
      task('x', { boardPosition: 2048 }),
      task('y', { boardPosition: 1024 }),
      task('z', { createdAt: '2026-09-01T00:00:00.000Z' }),
      task('r', { status: 'in_progress', statusId: 'revisao' }),
      task('sumiu', { status: 'in_progress', statusId: 'apagado' }),
    ];
    const board = buildBoard(tasks, tasks, keys, new Set(['revisao']));
    expect(board.columns.get('todo')!.map((item) => item.id)).toEqual(['y', 'x', 'z']);
    expect(board.columns.get('revisao')!.map((item) => item.id)).toEqual(['r']);
    expect(board.columns.get('in_progress')!.map((item) => item.id)).toEqual(['sumiu']);
  });

  it('índice de soltar conta os cartões com o meio acima do ponteiro', () => {
    expect(dropIndex([], 100)).toBe(0);
    expect(dropIndex([50, 150, 250], 10)).toBe(0);
    expect(dropIndex([50, 150, 250], 151)).toBe(2);
    expect(dropIndex([50, 150, 250], 900)).toBe(3);
  });

  it('vizinho de cima e soltar no mesmo lugar', () => {
    expect(afterIdAt(['a', 'b'], 0)).toBeNull();
    expect(afterIdAt(['a', 'b'], 1)).toBe('a');
    expect(afterIdAt(['a', 'b'], 5)).toBe('b');
    expect(isSamePlace(['a', 'x', 'b'], 'x', 1)).toBe(true);
    expect(isSamePlace(['a', 'x', 'b'], 'x', 2)).toBe(false);
    expect(isSamePlace(['a', 'b'], 'x', 0)).toBe(false);
  });

  it('rolagem automática só perto das bordas e mais rápida quanto mais perto', () => {
    expect(edgeSpeed(500, 0, 1000, 60, 20)).toBe(0);
    expect(edgeSpeed(30, 0, 1000, 60, 20)).toBe(-10);
    expect(edgeSpeed(0, 0, 1000, 60, 20)).toBe(-20);
    expect(edgeSpeed(-200, 0, 1000, 60, 20)).toBe(-20);
    expect(edgeSpeed(970, 0, 1000, 60, 20)).toBe(10);
    expect(edgeSpeed(1300, 0, 1000, 60, 20)).toBe(20);
    // Área pequena: a zona encolhe para um terço e o meio não rola.
    expect(edgeSpeed(45, 0, 90, 60, 20)).toBe(0);
    expect(edgeSpeed(10, 0, 0, 60, 20)).toBe(0);
  });
});
