// Modelo do Quadro (kanban), sem React: quais tarefas viram cartão em cada coluna, quais
// ficam dentro do cartão da mãe (subtarefas), onde o cartão arrastado vai cair e a
// velocidade da rolagem automática perto das bordas. Funções puras, testadas.
import { compareBoardCards, compareIds, effectiveStatusKey, type Id, type Task } from '@ott/shared';

export interface BoardModel {
  /** Cartões de cada coluna (chave do status), na ordem do quadro. */
  columns: Map<string, Task[]>;
  /** Subtarefas diretas de cada tarefa (todas, sem filtro), na ordem de `position`. */
  subtasks: Map<Id, Task[]>;
}

/**
 * Monta as colunas. `visible` são as tarefas que passaram pelos filtros; `all` são todas
 * as do workspace (para a lista de subtarefas do cartão ficar completa). Uma tarefa vira
 * cartão quando a mãe não está visível; com a mãe visível ela aparece dentro do cartão
 * da mãe, como item da lista de subtarefas.
 */
export function buildBoard(visible: readonly Task[], all: readonly Task[], keys: readonly string[], known: ReadonlySet<Id>): BoardModel {
  const shown = new Set(visible.map((task) => task.id));
  const columns = new Map<string, Task[]>(keys.map((key) => [key, []]));
  for (const task of visible) {
    if (task.parentId !== null && shown.has(task.parentId)) continue;
    columns.get(effectiveStatusKey(task, known))?.push(task);
  }
  for (const cards of columns.values()) cards.sort(compareBoardCards);

  const subtasks = new Map<Id, Task[]>();
  for (const task of all) {
    if (task.parentId === null) continue;
    const list = subtasks.get(task.parentId) ?? [];
    list.push(task);
    subtasks.set(task.parentId, list);
  }
  for (const list of subtasks.values()) list.sort((a, b) => a.position - b.position || compareIds(a.id, b.id));
  return { columns, subtasks };
}

/**
 * Índice em que o cartão cai numa coluna: quantos cartões (sem o arrastado) têm o meio
 * acima do ponteiro. Usar o meio dos cartões já deslocados pelo espaço reservado não
 * oscila: o espaço só muda de lugar quando o ponteiro passa do meio do vizinho.
 */
export function dropIndex(midpoints: readonly number[], pointer: number): number {
  let index = 0;
  for (const middle of midpoints) if (middle < pointer) index += 1;
  return index;
}

/** Cartão que fica logo acima do ponto de soltar (nulo: topo da coluna). */
export function afterIdAt(cardIds: readonly Id[], index: number): Id | null {
  return index <= 0 ? null : (cardIds[Math.min(index, cardIds.length) - 1] ?? null);
}

/**
 * Soltar no mesmo lugar não grava nada. `cardIds` é a coluna com o cartão arrastado e
 * `index` foi calculado sem ele.
 */
export function isSamePlace(cardIds: readonly Id[], movingId: Id, index: number): boolean {
  return cardIds.indexOf(movingId) === index;
}

/**
 * Velocidade da rolagem automática (px por quadro) num eixo: negativa perto do começo,
 * positiva perto do fim, zero no meio. Cresce até `max` conforme o ponteiro se aproxima da
 * borda e fica no máximo além dela (ponteiro sobre a barra lateral, por exemplo). A zona
 * nunca passa de um terço da área, para áreas pequenas não rolarem sempre.
 */
export function edgeSpeed(pointer: number, start: number, end: number, zone: number, max: number): number {
  const size = end - start;
  if (size <= 0) return 0;
  const edge = Math.min(zone, size / 3);
  if (pointer < start + edge) return -Math.round(max * Math.min(1, (start + edge - pointer) / edge));
  if (pointer > end - edge) return Math.round(max * Math.min(1, (pointer - (end - edge)) / edge));
  return 0;
}
