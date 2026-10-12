// Resultados da camada de dados que não são uma entidade simples.
import type { Currency, DependencyType, EstimateMode, Priority, TaskStatus } from './constants';
import type { Id, IsoDate, Task, User, Workspace } from './entities';

export interface SessionResponse {
  user: User;
  workspaces: Workspace[];
}

export interface ReportDayRow {
  date: IsoDate;
  seconds: number;
  billableSeconds: number;
}

export interface ReportProjectRow {
  projectId: Id | null;
  seconds: number;
  billableSeconds: number;
  amount: number;
  /** Subgrupos por descrição dentro do projeto, como no relatório resumido do Toggl. */
  items: { description: string; taskId: Id | null; seconds: number }[];
}

export interface ReportUserRow {
  userId: Id;
  seconds: number;
  billableSeconds: number;
  amount: number;
}

export interface ReportClientRow {
  clientId: Id | null;
  seconds: number;
}

export interface ReportSummary {
  start: IsoDate;
  end: IsoDate;
  currency: Currency;
  totalSeconds: number;
  billableSeconds: number;
  amount: number;
  entryCount: number;
  byDay: ReportDayRow[];
  byProject: ReportProjectRow[];
  byUser: ReportUserRow[];
  byClient: ReportClientRow[];
}

export interface ReportDetailedRow {
  id: Id;
  userId: Id;
  projectId: Id | null;
  taskId: Id | null;
  description: string;
  start: string;
  stop: string | null;
  /** Data local (no fuso pedido) em que o apontamento começou. */
  date: IsoDate;
  seconds: number;
  billable: boolean;
  amount: number;
  tagIds: Id[];
}

export interface ReportDetailed {
  start: IsoDate;
  end: IsoDate;
  currency: Currency;
  totalSeconds: number;
  billableSeconds: number;
  amount: number;
  rows: ReportDetailedRow[];
}

// --- Importação de tarefas por JSON ------------------------------------------

export type TaskImportIssueLevel = 'error' | 'warning';

/** Problema encontrado no arquivo. A web traduz pelo código (taskImport.issues). */
export interface TaskImportIssue {
  level: TaskImportIssueLevel;
  code: string;
  /** Onde está no arquivo, por exemplo tasks[0].subtasks[1].dueDate. */
  path: string;
  /** Número da tarefa na revisão (1, 1.2...), quando o problema é de uma tarefa. */
  taskKey: string | null;
  params: Record<string, string | number>;
}

export interface TaskImportRow {
  /** Numeração da árvore: 1, 1.1, 1.2, 2... */
  key: string;
  parentKey: string | null;
  depth: number;
  name: string;
  description: string;
  projectId: Id | null;
  /** Datas finais, já com a cascata e o resumo das tarefas-mãe aplicados. */
  startDate: IsoDate | null;
  dueDate: IsoDate | null;
  /** A cascata (ou o resumo das filhas) mudou as datas informadas no arquivo. */
  rescheduled: boolean;
  estimateSeconds: number | null;
  estimateMode: EstimateMode;
  priority: Priority;
  status: TaskStatus;
  progress: number;
  isMilestone: boolean;
  allowNonWorkingDays: boolean;
  billable: boolean;
  assigneeIds: Id[];
  tagNames: string[];
  dependencies: { name: string; type: DependencyType; lagDays: number }[];
}

export interface TaskImportPreview {
  rows: TaskImportRow[];
  issues: TaskImportIssue[];
  /** Tags que não existem e serão criadas. */
  newTags: string[];
  dependencyCount: number;
  canImport: boolean;
}

export interface TaskImportResult {
  created: number;
  tasks: Task[];
}
