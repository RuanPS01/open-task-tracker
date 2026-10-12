// Chaves do cache do React Query. Tudo de um workspace fica sob ['ws', id], então
// trocar de workspace ou sair invalida tudo de uma vez.
export const keys = {
  session: ['session'] as const,
  timer: ['timer'] as const,
  ws: (wid: number) => ['ws', wid] as const,
  members: (wid: number) => ['ws', wid, 'members'] as const,
  clients: (wid: number) => ['ws', wid, 'clients'] as const,
  tags: (wid: number) => ['ws', wid, 'tags'] as const,
  holidays: (wid: number) => ['ws', wid, 'holidays'] as const,
  projects: (wid: number) => ['ws', wid, 'projects'] as const,
  tasks: (wid: number) => ['ws', wid, 'tasks'] as const,
  dependencies: (wid: number) => ['ws', wid, 'dependencies'] as const,
  timeEntries: (wid: number) => ['ws', wid, 'time-entries'] as const,
  timeEntriesRange: (wid: number, from: string, to: string) => ['ws', wid, 'time-entries', from, to] as const,
  reports: (wid: number) => ['ws', wid, 'reports'] as const,
  report: (wid: number, kind: string, params: unknown) => ['ws', wid, 'reports', kind, params] as const,
};
