import type {
  CreateClientInput,
  CreateHolidayInput,
  CreateInviteInput,
  Id,
  ImportHolidaysInput,
  SessionResponse,
  UpdateClientInput,
  UpdateMemberInput,
  UpdateWorkspaceInput,
} from '@ott/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '../app/session';
import { backend } from './backend';
import { keys } from './keys';

export function useUpdateWorkspace() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: UpdateWorkspaceInput) => backend().workspaces.update(wid, input),
    onSuccess: (workspace) => {
      client.setQueryData<SessionResponse | null>(keys.session, (session) =>
        session
          ? { ...session, workspaces: session.workspaces.map((w) => (w.id === workspace.id ? workspace : w)) }
          : session,
      );
      // Dias úteis e agendamento automático mudam as datas calculadas do cronograma.
      void client.invalidateQueries({ queryKey: keys.tasks(wid) });
    },
  });
}

export function useCreateWorkspace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ name, demo }: { name: string; demo?: boolean }) => backend().workspaces.create(name, { demo }),
    onSuccess: async () => {
      client.removeQueries({ queryKey: ['ws'] });
      await client.invalidateQueries({ queryKey: keys.session });
    },
  });
}

// --- Membros e convites ------------------------------------------------------

export function useMembers() {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.members(wid),
    queryFn: () => backend().members.list(wid),
    staleTime: 60_000,
  });
}

export function useUpdateMember() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: ({ userId, ...input }: UpdateMemberInput & { userId: Id }) => backend().members.update(wid, userId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.members(wid) }),
  });
}

export function useRemoveMember() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (userId: Id) => backend().members.remove(wid, userId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.members(wid) });
      void client.invalidateQueries({ queryKey: keys.tasks(wid) });
    },
  });
}

export function useInvites(enabled: boolean) {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.invites(wid),
    queryFn: () => backend().members.listInvites(wid),
    enabled,
  });
}

export function useCreateInvite() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: CreateInviteInput) => backend().members.createInvite(wid, input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.invites(wid) }),
  });
}

export function useRevokeInvite() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (inviteId: Id) => backend().members.revokeInvite(wid, inviteId),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.invites(wid) }),
  });
}

/** Convite aberto pelo link (fora de qualquer workspace da pessoa). */
export function useInvite(workspaceId: Id, inviteId: Id) {
  return useQuery({
    queryKey: keys.invite(workspaceId, inviteId),
    queryFn: () => backend().members.getInvite(workspaceId, inviteId),
    retry: false,
  });
}

export function useAcceptInvite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, inviteId }: { workspaceId: Id; inviteId: Id }) =>
      backend().members.acceptInvite(workspaceId, inviteId),
    onSuccess: async () => {
      client.removeQueries({ queryKey: ['ws'] });
      await client.invalidateQueries({ queryKey: keys.session });
    },
  });
}

// --- Clientes --------------------------------------------------------------

export function useClients() {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.clients(wid),
    queryFn: () => backend().clients.list(wid),
    staleTime: 60_000,
  });
}

export function useCreateClient() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: CreateClientInput) => backend().clients.create(wid, input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.clients(wid) }),
  });
}

export function useUpdateClient() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateClientInput & { id: Id }) => backend().clients.update(wid, id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.clients(wid) }),
  });
}

export function useDeleteClient() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (id: Id) => backend().clients.remove(wid, id),
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
    queryFn: () => backend().tags.list(wid),
    staleTime: 60_000,
  });
}

export function useCreateTag() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (name: string) => backend().tags.create(wid, name),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.tags(wid) }),
  });
}

export function useRenameTag() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, name }: { id: Id; name: string }) => backend().tags.rename(wid, id, name),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.tags(wid) }),
  });
}

export function useDeleteTag() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (id: Id) => backend().tags.remove(wid, id),
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
    queryFn: () => backend().holidays.list(wid),
    staleTime: 5 * 60_000,
  });
}

/** Feriados mudam o calendário: datas e durações do cronograma também mudam. */
function invalidateCalendar(client: ReturnType<typeof useQueryClient>, wid: Id) {
  void client.invalidateQueries({ queryKey: keys.holidays(wid) });
  void client.invalidateQueries({ queryKey: keys.tasks(wid) });
}

export function useCreateHoliday() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: CreateHolidayInput) => backend().holidays.create(wid, input),
    onSuccess: () => invalidateCalendar(client, wid),
  });
}

export function useImportHolidays() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: ImportHolidaysInput) => backend().holidays.importNational(wid, input),
    onSuccess: () => invalidateCalendar(client, wid),
  });
}

export function useDeleteHoliday() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (id: Id) => backend().holidays.remove(wid, id),
    onSuccess: () => invalidateCalendar(client, wid),
  });
}
