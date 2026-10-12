// Formato das entidades como trafegam na API (JSON em camelCase).
// O banco usa snake_case; a conversão fica nos repositórios da API.
import type {
  Currency,
  DependencyType,
  DurationFormat,
  EstimateMode,
  Locale,
  MemberRole,
  Priority,
  TaskStatus,
  Theme,
  TimeFormat,
} from './constants';

export type Id = number;
/** Instante em UTC no formato ISO 8601, por exemplo 2026-10-12T14:00:00.000Z. */
export type IsoDateTime = string;
/** Data de calendário sem fuso, no formato AAAA-MM-DD. */
export type IsoDate = string;

export interface UserPreferences {
  theme: Theme;
  locale: Locale;
  /** 0 para domingo, 1 para segunda-feira. */
  weekStart: 0 | 1;
  timeFormat: TimeFormat;
  durationFormat: DurationFormat;
  timezone: string;
}

export interface User {
  id: Id;
  name: string;
  email: string;
  avatarColor: string;
  currentWorkspaceId: Id | null;
  preferences: UserPreferences;
  createdAt: IsoDateTime;
}

export interface Workspace {
  id: Id;
  name: string;
  currency: Currency;
  defaultHourlyRate: number | null;
  /** Dias úteis como números de 0 (domingo) a 6 (sábado). */
  workingDays: number[];
  /** Quando ligado, mover uma tarefa empurra as sucessoras no Gantt. */
  autoSchedule: boolean;
  /** Papel do usuário logado neste workspace. */
  role: MemberRole;
  createdAt: IsoDateTime;
}

export interface Member {
  userId: Id;
  workspaceId: Id;
  name: string;
  email: string;
  avatarColor: string;
  role: MemberRole;
  weeklyCapacityHours: number;
  hourlyRate: number | null;
  active: boolean;
  joinedAt: IsoDateTime;
}

export interface Client {
  id: Id;
  workspaceId: Id;
  name: string;
  archived: boolean;
  projectCount: number;
  createdAt: IsoDateTime;
}

export interface Tag {
  id: Id;
  workspaceId: Id;
  name: string;
  createdAt: IsoDateTime;
}

export interface Project {
  id: Id;
  workspaceId: Id;
  clientId: Id | null;
  name: string;
  color: string;
  billable: boolean;
  estimateSeconds: number | null;
  hourlyRate: number | null;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  archived: boolean;
  /** Fixado pelo usuário logado (preferência individual, como no Toggl). */
  pinned: boolean;
  trackedSeconds: number;
  taskCount: number;
  doneTaskCount: number;
  /** Usuários que apontaram horas ou são responsáveis por tarefas do projeto. */
  memberIds: Id[];
  createdAt: IsoDateTime;
}

export interface Task {
  id: Id;
  workspaceId: Id;
  projectId: Id | null;
  parentId: Id | null;
  name: string;
  description: string;
  notes: string;
  status: TaskStatus;
  priority: Priority;
  startDate: IsoDate | null;
  dueDate: IsoDate | null;
  estimateSeconds: number | null;
  estimateMode: EstimateMode;
  /** Percentual de 0 a 100 exibido na barra do Gantt. */
  progress: number;
  isMilestone: boolean;
  billable: boolean;
  /** Ordem manual dentro do mesmo pai (Gantt e quadro). */
  position: number;
  assigneeIds: Id[];
  tagIds: Id[];
  trackedSeconds: number;
  createdBy: Id;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  completedAt: IsoDateTime | null;
}

export interface TaskDependency {
  id: Id;
  workspaceId: Id;
  predecessorId: Id;
  successorId: Id;
  type: DependencyType;
  /** Atraso em dias úteis; negativo antecipa a sucessora. */
  lagDays: number;
}

export interface TimeEntry {
  id: Id;
  workspaceId: Id;
  userId: Id;
  projectId: Id | null;
  taskId: Id | null;
  description: string;
  start: IsoDateTime;
  /** Nulo enquanto o cronômetro está rodando. */
  stop: IsoDateTime | null;
  /** Duração em segundos; para entrada rodando, é o tempo decorrido no momento da resposta. */
  duration: number;
  billable: boolean;
  tagIds: Id[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
