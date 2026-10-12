import type {
  CreateTimeEntryInput,
  Id,
  StartTimerInput,
  TimeEntry,
  UpdateTimeEntryInput,
} from '@ott/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '../app/session';
import { backend } from './backend';
import { keys } from './keys';

/** Cronômetro rodando (global da pessoa). Revalida ao voltar para a aba. */
export function useRunningTimer() {
  return useQuery({
    queryKey: keys.timer,
    queryFn: () => backend().session.runningTimer(),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}

export function useTimeEntries(from: string, to: string) {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.timeEntriesRange(wid, from, to),
    queryFn: () => backend().timeEntries.list(wid, from, to),
    staleTime: 15_000,
  });
}

/** Tudo que depende de horas registradas: listas, cronômetro, tarefas, projetos, relatórios. */
function invalidateTracking(client: QueryClient, wid: Id) {
  void client.invalidateQueries({ queryKey: keys.timer });
  void client.invalidateQueries({ queryKey: keys.timeEntries(wid) });
  void client.invalidateQueries({ queryKey: keys.tasks(wid) });
  void client.invalidateQueries({ queryKey: keys.projects(wid) });
  void client.invalidateQueries({ queryKey: keys.reports(wid) });
}

function patchEntryEverywhere(client: QueryClient, wid: Id, id: Id, change: Partial<TimeEntry> | null) {
  client.setQueriesData<TimeEntry[]>({ queryKey: keys.timeEntries(wid) }, (list) => {
    if (!list) return list;
    if (change === null) return list.filter((entry) => entry.id !== id);
    return list.map((entry) => (entry.id === id ? { ...entry, ...change } : entry));
  });
}

export function useStartTimer() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: StartTimerInput) => backend().timeEntries.start(wid, input),
    onSuccess: (entry) => {
      client.setQueryData(keys.timer, entry);
      invalidateTracking(client, wid);
    },
  });
}

export function useStopTimer() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    // O cronômetro pode ser de outro workspace: usa o workspace do próprio apontamento.
    mutationFn: (entry: TimeEntry) => backend().timeEntries.stop(entry.workspaceId, entry.id),
    onMutate: () => {
      const previous = client.getQueryData<TimeEntry | null>(keys.timer);
      client.setQueryData(keys.timer, null);
      return { previous };
    },
    onError: (_error, _entry, context) => client.setQueryData(keys.timer, context?.previous ?? null),
    onSettled: () => invalidateTracking(client, wid),
  });
}

export function useCreateTimeEntry() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: CreateTimeEntryInput) => backend().timeEntries.create(wid, input),
    onSuccess: () => invalidateTracking(client, wid),
  });
}

export function useUpdateTimeEntry() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateTimeEntryInput & { id: Id }) => backend().timeEntries.update(wid, id, input),
    onMutate: async ({ id, ...input }) => {
      await client.cancelQueries({ queryKey: keys.timeEntries(wid) });
      const snapshot = client.getQueriesData<TimeEntry[]>({ queryKey: keys.timeEntries(wid) });
      const change: Partial<TimeEntry> = { ...input } as Partial<TimeEntry>;
      if (input.start && input.stop) change.duration = (Date.parse(input.stop) - Date.parse(input.start)) / 1000;
      patchEntryEverywhere(client, wid, id, change);
      const timer = client.getQueryData<TimeEntry | null>(keys.timer);
      if (timer?.id === id) client.setQueryData(keys.timer, { ...timer, ...change });
      return { snapshot };
    },
    onError: (_error, _input, context) => {
      for (const [key, data] of context?.snapshot ?? []) client.setQueryData(key, data);
    },
    onSettled: () => invalidateTracking(client, wid),
  });
}

export function useDeleteTimeEntry() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (id: Id) => backend().timeEntries.remove(wid, id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: keys.timeEntries(wid) });
      const snapshot = client.getQueriesData<TimeEntry[]>({ queryKey: keys.timeEntries(wid) });
      patchEntryEverywhere(client, wid, id, null);
      return { snapshot };
    },
    onError: (_error, _id, context) => {
      for (const [key, data] of context?.snapshot ?? []) client.setQueryData(key, data);
    },
    onSettled: () => invalidateTracking(client, wid),
  });
}
