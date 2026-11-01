import { describe, expect, it } from 'vitest';
import type { CustomStatus } from '../src/entities';
import { statusAppliesTo, statusesFor, statusKey, statusKeysFor } from '../src/statuses';

const status = (id: string, category: CustomStatus['category'], projectId: string | null, position: number): CustomStatus => ({
  id,
  workspaceId: 'w',
  projectId,
  name: id,
  category,
  icon: 'eye',
  color: '#9e5bd9',
  position,
  createdAt: '2026-10-01T00:00:00.000Z',
});

describe('status customizados', () => {
  const list = [
    status('aguardando', 'todo', 'p2', 1),
    status('revisao', 'in_progress', null, 2),
    status('bloqueada', 'todo', null, 3),
    status('homologacao', 'in_progress', 'p1', 1),
    status('entregue', 'done', null, 4),
  ];

  it('status do workspace vale para todas as tarefas; o do projeto, só para as dele', () => {
    expect(statusAppliesTo({ projectId: null }, null)).toBe(true);
    expect(statusAppliesTo({ projectId: null }, 'p1')).toBe(true);
    expect(statusAppliesTo({ projectId: 'p1' }, 'p1')).toBe(true);
    expect(statusAppliesTo({ projectId: 'p1' }, 'p2')).toBe(false);
    expect(statusAppliesTo({ projectId: 'p1' }, null)).toBe(false);
  });

  it('ordena por categoria, workspace antes de projeto e depois pela posição', () => {
    expect(statusesFor(list, 'p1').map((item) => item.id)).toEqual(['bloqueada', 'revisao', 'homologacao', 'entregue']);
    expect(statusesFor(list, null).map((item) => item.id)).toEqual(['bloqueada', 'revisao', 'entregue']);
  });

  it('chaves disponíveis: cada padrão seguido dos customizados da categoria', () => {
    expect(statusKeysFor(list, 'p2')).toEqual(['todo', 'bloqueada', 'aguardando', 'in_progress', 'revisao', 'done', 'entregue']);
  });

  it('a chave da tarefa é o status customizado ou a categoria', () => {
    expect(statusKey({ status: 'in_progress', statusId: null })).toBe('in_progress');
    expect(statusKey({ status: 'in_progress', statusId: 'revisao' })).toBe('revisao');
  });
});
