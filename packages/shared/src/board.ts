// Ordem manual dos cartões no Quadro (kanban), como no Trello. Cada tarefa guarda
// `boardPosition`, um número que só vale para comparar cartões da mesma coluna (mesmo
// status). Mover um cartão grava só ele, com um valor entre os vizinhos, em vez de
// renumerar a coluna inteira a cada arraste. Usado pela camada de dados (grava) e pela
// web (prévia otimista), escrito uma vez só.
import { compareIds } from './ids';
import type { Id, Task } from './entities';

/** Distância entre cartões quando a coluna recebe posições novas em sequência. */
export const BOARD_STEP = 1024;

/**
 * Menor distância aceita entre dois vizinhos. Abaixo disso a média perde precisão no
 * ponto flutuante (depois de dezenas de cartões soltos no mesmo lugar) e a coluna é
 * renumerada.
 */
export const BOARD_MIN_GAP = 1e-6;

export type BoardCard = Pick<Task, 'id' | 'boardPosition' | 'createdAt' | 'position'>;

/**
 * Ordem dos cartões numa coluna. Quem tem posição vem antes, em ordem crescente; quem
 * nunca foi arrastado (`boardPosition` nulo: tarefa nova, antiga ou que mudou de status
 * fora do quadro) vai para o fim, pela data de criação. Assim tarefa nova entra no fim
 * da coluna sem gravar nada além dela.
 */
export function compareBoardCards(a: BoardCard, b: BoardCard): number {
  if (a.boardPosition !== b.boardPosition) {
    if (a.boardPosition === null) return 1;
    if (b.boardPosition === null) return -1;
    return a.boardPosition - b.boardPosition;
  }
  return a.createdAt.localeCompare(b.createdAt) || a.position - b.position || compareIds(a.id, b.id);
}

/**
 * Posições novas para pôr `movingId` logo depois de `afterId` (nulo: no topo) na coluna.
 * `column` são os cartões da coluna de destino em qualquer ordem; o que se move é
 * ignorado se estiver nela. `afterId` que não está na coluna (sumiu ou mudou de status em
 * outra aba) leva o cartão para o fim. Devolve só o que precisa ser gravado: sempre o
 * cartão movido e, quando faltar espaço, os vizinhos.
 */
export function planBoardMove(column: readonly BoardCard[], movingId: Id, afterId: Id | null): Map<Id, number> {
  const ordered = column.filter((card) => card.id !== movingId).sort(compareBoardCards);
  let index = 0;
  if (afterId !== null) {
    const found = ordered.findIndex((card) => card.id === afterId);
    index = found === -1 ? ordered.length : found + 1;
  }
  const changes = new Map<Id, number>();

  // Os sem posição ficam no fim. Se o cartão vai para depois de algum deles, eles ganham
  // posição em sequência (os de depois continuam sem posição, ainda abaixo do movido).
  let previous: number | null = null;
  for (const card of ordered.slice(0, index)) {
    if (card.boardPosition === null) {
      previous = (previous ?? 0) + BOARD_STEP;
      changes.set(card.id, previous);
    } else {
      previous = card.boardPosition;
    }
  }

  const next = ordered[index]?.boardPosition ?? null;
  if (next === null) {
    changes.set(movingId, (previous ?? 0) + BOARD_STEP);
    return changes;
  }
  if (previous === null) {
    changes.set(movingId, next - BOARD_STEP);
    return changes;
  }
  const middle = (previous + next) / 2;
  if (next - previous > BOARD_MIN_GAP && middle > previous && middle < next) {
    changes.set(movingId, middle);
    return changes;
  }

  // Sem espaço entre os vizinhos: renumera os cartões com posição, já com o movido no
  // lugar novo. Os sem posição continuam no fim.
  const ranked = ordered.filter((card) => card.boardPosition !== null).map((card) => card.id);
  ranked.splice(index, 0, movingId);
  const current = new Map(ordered.map((card) => [card.id, card.boardPosition]));
  ranked.forEach((id, position) => {
    const value = (position + 1) * BOARD_STEP;
    if (id === movingId || current.get(id) !== value) changes.set(id, value);
  });
  return changes;
}
