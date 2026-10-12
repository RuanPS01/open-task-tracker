// Dados do workspace que entram no prompt para IA da importação de tarefas, e as datas
// do exemplo. O texto do prompt fica nos dicionários (taskImport.aiPrompt); aqui só se
// junta o que ele precisa, em funções puras e testáveis.
import {
  addDays,
  addWorkdays,
  nextWorkday,
  type CalendarInput,
  type Holiday,
  type Id,
  type IsoDate,
  type Member,
  type Project,
  type Tag,
  type Task,
} from '@ott/shared';
import type { ImportExampleDates, ImportPromptContext } from '../../i18n/pt-BR';

/** Quantas tarefas existentes vão no prompt, no máximo (o resto não cabe bem num prompt). */
export const MAX_PROMPT_TASKS = 150;
// Um domingo qualquer, para dar nome aos dias da semana pelo número (0 a 6).
const SUNDAY: IsoDate = '2026-10-11';

export function exampleDates(today: IsoDate, calendar: CalendarInput): ImportExampleDates {
  const start = nextWorkday(today, calendar);
  const second = addWorkdays(start, 3, calendar);
  return { start, second, approval: addWorkdays(second, 2, calendar) };
}

export interface PromptSource {
  today: IsoDate;
  weekdayName: (iso: IsoDate) => string;
  workingDays: readonly number[];
  holidays: readonly Holiday[];
  autoSchedule: boolean;
  projects: readonly Project[];
  currentProjectId: Id | null;
  members: readonly Member[];
  tags: readonly Tag[];
  tasks: readonly Task[];
  example: string;
}

export function promptContext(source: PromptSource): ImportPromptContext {
  // Semana começando na segunda, como no calendário brasileiro.
  const order = [1, 2, 3, 4, 5, 6, 0].filter((day) => source.workingDays.includes(day));
  const horizon = addDays(source.today, 366);
  const current = source.projects.find((project) => project.id === source.currentProjectId) ?? null;
  const existing = current
    ? [...new Set(source.tasks.filter((task) => task.projectId === current.id).map((task) => task.name))]
    : [];
  return {
    today: source.today,
    todayWeekday: source.weekdayName(source.today),
    workingDays: order.map((day) => source.weekdayName(addDays(SUNDAY, day))).join(', '),
    holidays: source.holidays
      .filter((holiday) => holiday.date >= source.today && holiday.date <= horizon)
      .map((holiday) => `${holiday.date} ${holiday.name}`),
    autoSchedule: source.autoSchedule,
    projects: source.projects.filter((project) => !project.archived).map((project) => project.name),
    currentProject: current?.name ?? null,
    members: source.members.filter((member) => member.active).map((member) => `${member.name} <${member.email}>`),
    tags: source.tags.map((tag) => tag.name),
    existingTasks: existing.slice(0, MAX_PROMPT_TASKS),
    example: source.example,
  };
}
