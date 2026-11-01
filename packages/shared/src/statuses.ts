// Status de tarefa: os três padrão (as categorias) mais os criados pela equipe, no
// workspace inteiro ou num projeto. Regras usadas pela camada de dados (validar o status
// de uma tarefa) e pela web (menu, quadro, agrupamento), escritas uma vez só.
import { TASK_STATUSES, type TaskStatus } from './constants';
import type { CustomStatus, Id, Task } from './entities';

type StatusScope = Pick<CustomStatus, 'projectId'>;
type Sortable = Pick<CustomStatus, 'id' | 'projectId' | 'category' | 'position'>;

/** O status vale para tarefas deste projeto (status do workspace vale para todas). */
export const statusAppliesTo = (status: StatusScope, projectId: Id | null): boolean =>
  status.projectId === null || status.projectId === projectId;

/**
 * Ordem de exibição: pela categoria (a fazer, em andamento, concluído), os do workspace
 * antes dos do projeto, depois pela posição. O padrão de cada categoria vem antes dos
 * customizados dela (ver `statusKeysFor`).
 */
export function compareStatuses(a: Sortable, b: Sortable): number {
  return (
    TASK_STATUSES.indexOf(a.category) - TASK_STATUSES.indexOf(b.category) ||
    Number(a.projectId !== null) - Number(b.projectId !== null) ||
    a.position - b.position ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Status customizados disponíveis para uma tarefa do projeto, já na ordem de exibição. */
export function statusesFor<T extends Sortable>(statuses: readonly T[], projectId: Id | null): T[] {
  return statuses.filter((status) => statusAppliesTo(status, projectId)).sort(compareStatuses);
}

/**
 * Chave do status da tarefa: o id do status customizado ou a categoria (status padrão).
 * Ids gerados têm 20 caracteres e nunca colidem com `todo`, `in_progress` e `done`.
 */
export const statusKey = (task: Pick<Task, 'status' | 'statusId'>): string => task.statusId ?? task.status;

/** Chaves disponíveis para um projeto, na ordem: cada padrão seguido dos customizados da categoria. */
export function statusKeysFor(statuses: readonly Sortable[], projectId: Id | null): string[] {
  const available = statusesFor(statuses, projectId);
  return TASK_STATUSES.flatMap((category: TaskStatus) => [
    category,
    ...available.filter((status) => status.category === category).map((status) => status.id),
  ]);
}
