// Chaves do cache do React Query. Tudo de um workspace fica sob ['ws', id], então
// trocar de workspace ou sair invalida tudo de uma vez.
import type { Id } from '@ott/shared';

export const keys = {
  session: ['session'] as const,
  timer: ['timer'] as const,
  invite: (wid: Id, inviteId: Id) => ['invite', wid, inviteId] as const,
  ws: (wid: Id) => ['ws', wid] as const,
  members: (wid: Id) => ['ws', wid, 'members'] as const,
  invites: (wid: Id) => ['ws', wid, 'invites'] as const,
  clients: (wid: Id) => ['ws', wid, 'clients'] as const,
  tags: (wid: Id) => ['ws', wid, 'tags'] as const,
  holidays: (wid: Id) => ['ws', wid, 'holidays'] as const,
  projects: (wid: Id) => ['ws', wid, 'projects'] as const,
  tasks: (wid: Id) => ['ws', wid, 'tasks'] as const,
  dependencies: (wid: Id) => ['ws', wid, 'dependencies'] as const,
  timeEntries: (wid: Id) => ['ws', wid, 'time-entries'] as const,
  timeEntriesRange: (wid: Id, from: string, to: string) => ['ws', wid, 'time-entries', from, to] as const,
  reports: (wid: Id) => ['ws', wid, 'reports'] as const,
  report: (wid: Id, kind: string, params: unknown) => ['ws', wid, 'reports', kind, params] as const,
};
