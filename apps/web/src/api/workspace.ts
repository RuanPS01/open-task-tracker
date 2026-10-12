import type {
  CreateHolidayInput,
  Holiday,
  ImportHolidaysInput,
  AddMemberInput,
  AddMemberResponse,
  Client,
  CreateClientInput,
  Member,
  SessionResponse,
  Tag,
  UpdateClientInput,
  UpdateMemberInput,
  UpdateWorkspaceInput,
  Workspace,
} from '@ott/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '../app/session';
import { request } from './client';
import { keys } from './keys';

export function useUpdateWorkspace() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: UpdateWorkspaceInput) => request<Workspace>(`/workspaces/${wid}`, { method: 'PATCH', body: input }),
    onSuccess: (workspace) => {
      client.setQueryData<SessionResponse | null>(keys.session, (session) =>
        session
          ? { ...session, workspaces: session.workspaces.map((w) => (w.id === workspace.id ? workspace : w)) }
          : session,
      );
      // Dias úteis e agendamento automático mudam datas calculadas no servidor.
      void client.invalidateQueries({ queryKey: keys.tasks(wid) });
    },
  });
}

export function useCreateWorkspace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => request<Workspace>('/workspaces', { method: 'POST', body: { name } }),
    onSuccess: async () => {
      client.removeQueries({ queryKey: ['ws'] });
      await client.invalidateQueries({ queryKey: keys.session });
    },
  });
}

// --- Membros ---------------------------------------------------------------

export function useMembers() {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.members(wid),
    queryFn: () => request<Member[]>(`/workspaces/${wid}/members`),
    staleTime: 60_000,
  });
}

export function useAddMember() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: AddMemberInput) =>
      request<AddMemberResponse>(`/workspaces/${wid}/members`, { method: 'POST', body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.members(wid) }),
  });
}

export function useUpdateMember() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: ({ userId, ...input }: UpdateMemberInput & { userId: number }) =>
      request<Member>(`/workspaces/${wid}/members/${userId}`, { method: 'PATCH', body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.members(wid) }),
  });
}

export function useRemoveMember() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (userId: number) => request<void>(`/workspaces/${wid}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.members(wid) });
      void client.invalidateQueries({ queryKey: keys.tasks(wid) });
    },
  });
}

// --- Clientes --------------------------------------------------------------

export function useClients() {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.clients(wid),
    queryFn: () => request<Client[]>(`/workspaces/${wid}/clients`),
    staleTime: 60_000,
  });
}

export function useCreateClient() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: CreateClientInput) => request<Client>(`/workspaces/${wid}/clients`, { method: 'POST', body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.clients(wid) }),
  });
}

export function useUpdateClient() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateClientInput & { id: number }) =>
      request<Client>(`/workspaces/${wid}/clients/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.clients(wid) }),
  });
}

export function useDeleteClient() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (id: number) => request<void>(`/workspaces/${wid}/clients/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.clients(wid) });
      void client.invalidateQueries({ queryKey: keys.projects(wid) });
    },
  });
}

// --- Tags ------------------------------------------------------------------

export function useTags() {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.tags(wid),
    queryFn: () => request<Tag[]>(`/workspaces/${wid}/tags`),
    staleTime: 60_000,
  });
}

export function useCreateTag() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (name: string) => request<Tag>(`/workspaces/${wid}/tags`, { method: 'POST', body: { name } }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.tags(wid) }),
  });
}

export function useRenameTag() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      request<Tag>(`/workspaces/${wid}/tags/${id}`, { method: 'PATCH', body: { name } }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.tags(wid) }),
  });
}

export function useDeleteTag() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (id: number) => request<void>(`/workspaces/${wid}/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.tags(wid) });
      void client.invalidateQueries({ queryKey: keys.tasks(wid) });
      void client.invalidateQueries({ queryKey: keys.timeEntries(wid) });
    },
  });
}

// --- Feriados ----------------------------------------------------------------

export function useHolidays() {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.holidays(wid),
    queryFn: () => request<Holiday[]>(`/workspaces/${wid}/holidays`),
    staleTime: 5 * 60_000,
  });
}

/** Feriados mudam o calendário: datas e durações calculadas no servidor também mudam. */
function invalidateCalendar(client: ReturnType<typeof useQueryClient>, wid: number) {
  void client.invalidateQueries({ queryKey: keys.holidays(wid) });
  void client.invalidateQueries({ queryKey: keys.tasks(wid) });
}

export function useCreateHoliday() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: CreateHolidayInput) => request<Holiday>(`/workspaces/${wid}/holidays`, { method: 'POST', body: input }),
    onSuccess: () => invalidateCalendar(client, wid),
  });
}

export function useImportHolidays() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: ImportHolidaysInput) =>
      request<{ created: number; holidays: Holiday[] }>(`/workspaces/${wid}/holidays/import`, { method: 'POST', body: input }),
    onSuccess: () => invalidateCalendar(client, wid),
  });
}

export function useDeleteHoliday() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (id: number) => request<void>(`/workspaces/${wid}/holidays/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateCalendar(client, wid),
  });
}
