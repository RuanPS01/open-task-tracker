import { describe, expect, it } from 'vitest';
import { BOARD_STEP, boardTopPositions, compareBoardCards, planBoardMove, type BoardCard } from '../src/board';
import { effectiveStatusKey } from '../src/statuses';

const card = (id: string, boardPosition: number | null, createdAt = '2026-10-01T00:00:00.000Z', position = 1): BoardCard => ({
  id,
  boardPosition,
  createdAt,
  position,
});

const order = (cards: BoardCard[]) => [...cards].sort(compareBoardCards).map((item) => item.id);

/** Aplica o plano e devolve a ordem final da coluna (com o cartão movido). */
function apply(column: BoardCard[], moving: BoardCard, afterId: string | null): string[] {
  const plan = planBoardMove(column, moving.id, afterId);
  const all = [...column.filter((item) => item.id !== moving.id), moving].map((item) =>
    plan.has(item.id) ? { ...item, boardPosition: plan.get(item.id)! } : item,
  );
  return order(all);
}

describe('ordem dos cartões no quadro', () => {
  it('cartões com posição vêm antes; os sem posição vão para o fim pela data de criação', () => {
    const cards = [
      card('novo', null, '2026-10-05T00:00:00.000Z'),
      card('b', 2048),
      card('antigo', null, '2026-10-02T00:00:00.000Z'),
      card('a', 1024),
    ];
    expect(order(cards)).toEqual(['a', 'b', 'antigo', 'novo']);
  });

  it('desempata pela posição entre irmãos e pelo id quando criados no mesmo instante', () => {
    expect(order([card('z', null, undefined, 2), card('y', null, undefined, 1), card('x', null, undefined, 1)])).toEqual(['x', 'y', 'z']);
  });

  it('põe no meio dos vizinhos gravando só o cartão movido', () => {
    const column = [card('a', 1024), card('b', 2048), card('c', 3072)];
    const plan = planBoardMove(column, 'x', 'a');
    expect([...plan]).toEqual([['x', 1536]]);
    expect(apply(column, card('x', 9999), 'a')).toEqual(['a', 'x', 'b', 'c']);
  });

  it('topo fica antes do primeiro e fim depois do último', () => {
    const column = [card('a', 1024), card('b', 2048)];
    expect(planBoardMove(column, 'x', null).get('x')).toBe(1024 - BOARD_STEP);
    expect(planBoardMove(column, 'x', 'b').get('x')).toBe(2048 + BOARD_STEP);
    expect(planBoardMove([], 'x', null).get('x')).toBe(BOARD_STEP);
  });

  it('reordena dentro da mesma coluna ignorando a posição antiga do cartão', () => {
    const column = [card('a', 1024), card('b', 2048), card('c', 3072)];
    expect(apply(column, column[0]!, 'c')).toEqual(['b', 'c', 'a']);
    expect(apply(column, column[2]!, null)).toEqual(['c', 'a', 'b']);
  });

  it('cartões sem posição antes do ponto de inserção ganham posição em sequência', () => {
    const column = [
      card('a', 1024),
      card('n1', null, '2026-10-02T00:00:00.000Z'),
      card('n2', null, '2026-10-03T00:00:00.000Z'),
      card('n3', null, '2026-10-04T00:00:00.000Z'),
    ];
    const plan = planBoardMove(column, 'x', 'n2');
    expect([...plan]).toEqual([
      ['n1', 2048],
      ['n2', 3072],
      ['x', 4096],
    ]);
    expect(apply(column, card('x', null), 'n2')).toEqual(['a', 'n1', 'n2', 'x', 'n3']);
  });

  it('coluna antiga sem nenhuma posição aceita o cartão no topo sem gravar as outras', () => {
    const column = [card('n1', null), card('n2', null, '2026-10-02T00:00:00.000Z')];
    expect([...planBoardMove(column, 'x', null)]).toEqual([['x', BOARD_STEP]]);
    expect(apply(column, card('x', null), null)).toEqual(['x', 'n1', 'n2']);
  });

  it('vizinho que não está na coluna leva o cartão para o fim', () => {
    const column = [card('a', 1024), card('b', 2048)];
    expect(apply(column, card('x', null), 'sumiu')).toEqual(['a', 'b', 'x']);
  });

  it('renumera a coluna quando não há mais espaço entre os vizinhos', () => {
    const column = [card('a', 1), card('b', 1 + 1e-7), card('c', 5)];
    const plan = planBoardMove(column, 'x', 'a');
    expect(plan.get('x')).toBe(2 * BOARD_STEP);
    expect(apply(column, card('x', null), 'a')).toEqual(['a', 'x', 'b', 'c']);
  });

  it('soltar muitas vezes no mesmo lugar nunca embaralha a ordem', () => {
    let column = [card('a', 1024), card('b', 2048)];
    for (let i = 0; i < 80; i += 1) {
      const moving = card(`x${i}`, null);
      const plan = planBoardMove(column, moving.id, 'a');
      column = [...column, moving].map((item) => (plan.has(item.id) ? { ...item, boardPosition: plan.get(item.id)! } : item));
    }
    const final = order(column);
    expect(final[0]).toBe('a');
    expect(final[1]).toBe('x79');
    expect(final.at(-1)).toBe('b');
    expect(new Set(column.map((item) => item.boardPosition)).size).toBe(column.length);
  });

  it('cartões novos no topo ficam acima de todos, na ordem dada', () => {
    const column = [card('a', 2048), card('b', 4096), card('n', null)];
    const positions = boardTopPositions(column, 3);
    expect(positions).toEqual([2048 - 3 * BOARD_STEP, 2048 - 2 * BOARD_STEP, 2048 - BOARD_STEP]);
    const all = [...column, ...positions.map((value, index) => card(`x${index}`, value))];
    expect(order(all)).toEqual(['x0', 'x1', 'x2', 'a', 'b', 'n']);
    // Coluna sem nenhuma posição (só tarefas antigas): os novos também vêm antes.
    const legacy = [card('n1', null), card('n2', null)];
    const fresh = boardTopPositions(legacy, 2).map((value, index) => card(`y${index}`, value));
    expect(order([...legacy, ...fresh])).toEqual(['y0', 'y1', 'n1', 'n2']);
    expect(boardTopPositions([], 0)).toEqual([]);
  });

  it('status customizado excluído conta como o padrão da categoria', () => {
    const known = new Set(['revisao']);
    expect(effectiveStatusKey({ status: 'in_progress', statusId: 'revisao' }, known)).toBe('revisao');
    expect(effectiveStatusKey({ status: 'in_progress', statusId: 'sumiu' }, known)).toBe('in_progress');
    expect(effectiveStatusKey({ status: 'todo', statusId: null }, known)).toBe('todo');
  });
});
