import type { CreateStatusInput, Id, UpdateStatusInput } from '@ott/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '../app/session';
import { backend } from './backend';
import { keys } from './keys';

/** Status customizados do workspace inteiro (os do workspace e os de todos os projetos). */
export function useStatuses() {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.statuses(wid),
    queryFn: () => backend().statuses.list(wid),
    staleTime: 60_000,
  });
}

export function useCreateStatus() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: CreateStatusInput) => backend().statuses.create(wid, input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.statuses(wid) }),
  });
}

/** Mudar a categoria muda o status das tarefas que usam o status: relê as tarefas também. */
export function useUpdateStatus() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateStatusInput & { id: Id }) => backend().statuses.update(wid, id, input),
    onSuccess: (_status, input) => {
      void client.invalidateQueries({ queryKey: keys.statuses(wid) });
      if (input.category !== undefined) {
        void client.invalidateQueries({ queryKey: keys.tasks(wid) });
        void client.invalidateQueries({ queryKey: keys.projects(wid) });
      }
    },
  });
}

/** As tarefas que usavam o status voltam ao padrão da categoria. */
export function useDeleteStatus() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (id: Id) => backend().statuses.remove(wid, id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.statuses(wid) });
      void client.invalidateQueries({ queryKey: keys.tasks(wid) });
    },
  });
}
