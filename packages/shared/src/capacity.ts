// Carga planejada por pessoa e por dia, usada na Linha do tempo (capacidade da equipe).
// Regra detalhada em docs/08-planejamento-gantt-e-algoritmos.md, seção "Capacidade".
import { NO_ID, type EstimateMode, type TaskStatus } from './constants';
import type { Id, IsoDate } from './entities';
import { eachDay, isWorkday, maxIsoDate, minIsoDate, workdaysBetween, type CalendarInput } from './dates';
import { calendarFor } from './scheduling';

export interface AllocatableTask {
  id: Id;
  parentId: Id | null;
  status: TaskStatus;
  startDate: IsoDate | null;
  dueDate: IsoDate | null;
  estimateSeconds: number | null;
  estimateMode: EstimateMode;
  assigneeIds: Id[];
  allowNonWorkingDays?: boolean;
}

/** Chave usada para tarefas sem responsável. */
export const UNASSIGNED = NO_ID;

export interface AllocationResult {
  /** Segundos planejados por pessoa (ou UNASSIGNED) e por dia. */
  byUser: Map<Id, Map<IsoDate, number>>;
  /** Segundos planejados por tarefa e por pessoa no intervalo pedido. */
  byTask: Map<Id, Map<Id, number>>;
}

/**
 * Distribui a estimativa de cada tarefa pelos dias úteis do intervalo dela.
 * - estimativa "total": divide igualmente entre dias úteis e responsáveis;
 * - estimativa "por dia": cada responsável recebe o valor inteiro em cada dia útil.
 * Tarefas concluídas, sem datas, sem estimativa ou com subtarefas ficam de fora: a
 * mãe não conta para não somar duas vezes o trabalho que já está nas filhas.
 * Tarefa liberada para fins de semana e feriados distribui por todos os dias.
 */
export function computeAllocations(
  tasks: readonly AllocatableTask[],
  range: { start: IsoDate; end: IsoDate },
  calendar: CalendarInput,
): AllocationResult {
  const parents = new Set(tasks.map((task) => task.parentId).filter((id): id is Id => id !== null));
  const byUser = new Map<Id, Map<IsoDate, number>>();
  const byTask = new Map<Id, Map<Id, number>>();

  for (const task of tasks) {
    if (task.status === 'done' || parents.has(task.id)) continue;
    if (!task.startDate || !task.dueDate || !task.estimateSeconds) continue;
    const taskCalendar = calendarFor(task, calendar);
    const workdays = workdaysBetween(task.startDate, task.dueDate, taskCalendar);
    if (workdays === 0) continue;
    const assignees = task.assigneeIds.length > 0 ? task.assigneeIds : [UNASSIGNED];
    const perDay =
      task.estimateMode === 'per_day'
        ? task.estimateSeconds
        : task.estimateSeconds / workdays / assignees.length;

    const from = maxIsoDate(task.startDate, range.start)!;
    const to = minIsoDate(task.dueDate, range.end)!;
    if (from > to) continue;

    for (const day of eachDay(from, to)) {
      if (!isWorkday(day, taskCalendar)) continue;
      for (const userId of assignees) {
        let days = byUser.get(userId);
        if (!days) {
          days = new Map();
          byUser.set(userId, days);
        }
        days.set(day, (days.get(day) ?? 0) + perDay);
        let perTask = byTask.get(task.id);
        if (!perTask) {
          perTask = new Map();
          byTask.set(task.id, perTask);
        }
        perTask.set(userId, (perTask.get(userId) ?? 0) + perDay);
      }
    }
  }
  return { byUser, byTask };
}

/** Capacidade diária em segundos a partir das horas semanais da pessoa. */
export function dailyCapacitySeconds(
  weeklyCapacityHours: number,
  workingDays: readonly number[],
): number {
  if (workingDays.length === 0) return 0;
  return (weeklyCapacityHours * 3600) / workingDays.length;
}

/** Capacidade total de uma pessoa no intervalo, contando só dias úteis (sem feriados). */
export function capacityInRange(
  weeklyCapacityHours: number,
  range: { start: IsoDate; end: IsoDate },
  calendar: CalendarInput,
): number {
  const workingDays = 'workingDays' in calendar ? calendar.workingDays : calendar;
  return (
    dailyCapacitySeconds(weeklyCapacityHours, workingDays) *
    workdaysBetween(range.start, range.end, calendar)
  );
}
