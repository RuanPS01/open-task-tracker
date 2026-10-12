// Caminhos das coleções e formato dos documentos guardados. É o mesmo nos dois
// modos: o lowdb guarda um objeto por caminho de coleção, o Firestore usa as
// coleções e subcoleções abaixo. As regras de acesso ficam em firestore.rules.
import type {
  Client,
  Currency,
  Holiday,
  Id,
  Invite,
  IsoDateTime,
  Member,
  Project,
  Tag,
  Task,
  TaskDependency,
  TimeEntry,
  UserPreferences,
} from '@ott/shared';

export const paths = {
  users: 'users',
  workspaces: 'workspaces',
  members: (wid: Id) => `workspaces/${wid}/members`,
  invites: (wid: Id) => `workspaces/${wid}/invites`,
  clients: (wid: Id) => `workspaces/${wid}/clients`,
  tags: (wid: Id) => `workspaces/${wid}/tags`,
  holidays: (wid: Id) => `workspaces/${wid}/holidays`,
  projects: (wid: Id) => `workspaces/${wid}/projects`,
  tasks: (wid: Id) => `workspaces/${wid}/tasks`,
  dependencies: (wid: Id) => `workspaces/${wid}/dependencies`,
  timeEntries: (wid: Id) => `workspaces/${wid}/timeEntries`,
} as const;

export interface UserDoc {
  id: Id;
  name: string;
  email: string;
  avatarColor: string;
  currentWorkspaceId: Id | null;
  preferences: UserPreferences;
  /** Projetos fixados pela pessoa (preferência individual, como no Toggl). */
  pinnedProjectIds: Id[];
  /** Cronômetro rodando, em qualquer workspace: um só por pessoa. */
  runningEntry: { workspaceId: Id; entryId: Id } | null;
  createdAt: IsoDateTime;
}

export interface WorkspaceDoc {
  id: Id;
  name: string;
  currency: Currency;
  defaultHourlyRate: number | null;
  workingDays: number[];
  autoSchedule: boolean;
  /** Uids dos membros ativos: é o que as regras do Firestore consultam para liberar acesso. */
  memberIds: Id[];
  /** Uids dos administradores ativos. */
  adminIds: Id[];
  createdBy: Id;
  createdAt: IsoDateTime;
}

/** Id do documento é o uid da pessoa. */
export type MemberDoc = Member & {
  /** Convite usado para entrar (as regras conferem papel e valores com ele). */
  inviteId?: Id | null;
};

export type InviteDoc = Invite;
export type ClientDoc = Omit<Client, 'projectCount'>;
export type TagDoc = Tag;
/** Id do documento é a própria data. */
export type HolidayDoc = Holiday;

export type ProjectDoc = Omit<Project, 'pinned' | 'taskCount' | 'doneTaskCount' | 'memberIds'> & {
  /** Quem já apontou horas no projeto (compõe a equipe mostrada na lista). */
  trackerIds: Id[];
  updatedAt: IsoDateTime;
};

export type TaskDoc = Task;
export type DependencyDoc = TaskDependency & { createdAt: IsoDateTime };
export type TimeEntryDoc = Omit<TimeEntry, 'duration'>;
