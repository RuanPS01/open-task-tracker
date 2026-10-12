// Valores fixos do domínio, compartilhados pela camada de dados e pela web.
// Mudou algum valor aqui? Atualize docs/06-dados-e-armazenamento.md.

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

// A ordem numérica é usada na ordenação por prioridade (maior primeiro).
export const PRIORITIES = [0, 1, 2, 3, 4] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_KEYS: Record<Priority, 'none' | 'low' | 'medium' | 'high' | 'urgent'> = {
  0: 'none',
  1: 'low',
  2: 'medium',
  3: 'high',
  4: 'urgent',
};

export const ESTIMATE_MODES = ['total', 'per_day'] as const;
export type EstimateMode = (typeof ESTIMATE_MODES)[number];

// FS: termina para começar (padrão). SS: começa junto. FF: termina junto. SF: começa para terminar.
export const DEPENDENCY_TYPES = ['FS', 'SS', 'FF', 'SF'] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export const MEMBER_ROLES = ['admin', 'member'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const THEMES = ['dark', 'light', 'system'] as const;
export type Theme = (typeof THEMES)[number];

export const LOCALES = ['pt-BR', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const TIME_FORMATS = ['24h', '12h'] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

// improved: 1:05:09. classic: 1 h 05 min. decimal: 1,09 h.
export const DURATION_FORMATS = ['improved', 'classic', 'decimal'] as const;
export type DurationFormat = (typeof DURATION_FORMATS)[number];

export const CURRENCIES = ['BRL', 'USD', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];

// Paleta de cores de projeto. Mesmo conjunto de tons do Toggl para que os projetos
// tenham contraste suficiente tanto no tema escuro quanto no claro.
export const PROJECT_COLORS = [
  '#0b83d9',
  '#9e5bd9',
  '#d94182',
  '#e36a00',
  '#bf7000',
  '#c7af14',
  '#d92b2b',
  '#2da608',
  '#06a893',
  '#c9806b',
  '#465bb3',
  '#990099',
  '#566614',
  '#525266',
] as const;

/**
 * Id reservado para "nenhum": filtro "sem projeto" nos relatórios, raia "sem
 * responsável" na capacidade. Ids gerados têm 20 caracteres e nunca colidem com ele.
 */
export const NO_ID = 'none';

export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5] as const;
export const DEFAULT_WEEKLY_CAPACITY_HOURS = 40;
export const MAX_TIME_ENTRY_SECONDS = 999 * 3600;
