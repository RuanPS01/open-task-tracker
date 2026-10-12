import type {
  CreateTimeEntryInput,
  StartTimerInput,
  TimeEntry,
  UpdateTimeEntryInput,
} from '@ott/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '../app/session';
import { request } from './client';
import { keys } from './keys';

/** Cronômetro rodando (global da pessoa). Revalida ao voltar para a aba. */
export function useRunningTimer() {
  return useQuery({
    queryKey: keys.timer,
    queryFn: async () => (await request<{ entry: TimeEntry | null }>('/me/timer')).entry,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}

export function useTimeEntries(from: string, to: string) {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.timeEntriesRange(wid, from, to),
    queryFn: () => request<TimeEntry[]>(`/workspaces/${wid}/time-entries`, { query: { from, to } }),
    staleTime: 15_000,
  });
}

/** Tudo que depende de horas registradas: listas, cronômetro, tarefas, projetos, relatórios. */
function invalidateTracking(client: QueryClient, wid: number) {
  void client.invalidateQueries({ queryKey: keys.timer });
  void client.invalidateQueries({ queryKey: keys.timeEntries(wid) });
  void client.invalidateQueries({ queryKey: keys.tasks(wid) });
  void client.invalidateQueries({ queryKey: keys.projects(wid) });
  void client.invalidateQueries({ queryKey: keys.reports(wid) });
}

function patchEntryEverywhere(client: QueryClient, wid: number, id: number, change: Partial<TimeEntry> | null) {
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
    mutationFn: (input: StartTimerInput) =>
      request<TimeEntry>(`/workspaces/${wid}/time-entries/start`, { method: 'POST', body: input }),
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
    mutationFn: (entry: TimeEntry) =>
      request<TimeEntry>(`/workspaces/${entry.workspaceId}/time-entries/${entry.id}/stop`, { method: 'POST', body: {} }),
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
    mutationFn: (input: CreateTimeEntryInput) =>
      request<TimeEntry>(`/workspaces/${wid}/time-entries`, { method: 'POST', body: input }),
    onSuccess: () => invalidateTracking(client, wid),
  });
}

export function useUpdateTimeEntry() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateTimeEntryInput & { id: number }) =>
      request<TimeEntry>(`/workspaces/${wid}/time-entries/${id}`, { method: 'PATCH', body: input }),
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
    mutationFn: (id: number) => request<void>(`/workspaces/${wid}/time-entries/${id}`, { method: 'DELETE' }),
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
