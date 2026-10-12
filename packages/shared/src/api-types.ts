// Formato das respostas da API que não são uma entidade simples.
import type { Currency } from './constants';
import type { Id, IsoDate, Member, User, Workspace } from './entities';

export interface ApiErrorBody {
  error: {
    /** Código estável para a web decidir a mensagem (ver docs/06-dados-e-api.md). */
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface SessionResponse {
  user: User;
  workspaces: Workspace[];
}

export interface AddMemberResponse {
  member: Member;
  /** Preenchido só quando a pessoa ainda não tinha conta: mostrar uma única vez. */
  temporaryPassword: string | null;
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
