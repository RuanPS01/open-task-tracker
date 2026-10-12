// Aritmética de datas de calendário (AAAA-MM-DD) sem fuso horário.
// Datas de tarefa e de Gantt não são instantes: "dia 12" é dia 12 em qualquer fuso.
// Por isso toda conta aqui usa UTC internamente, o que evita o defeito clássico de
// horário de verão em que somar 1 dia a meia-noite local cai no mesmo dia.
import type { IsoDate } from './entities';

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(m) - 1;
}

export function isoToUtcMs(iso: IsoDate): number {
  const match = ISO_DATE.exec(iso);
  if (!match) throw new Error(`Data inválida: ${iso}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function utcMsToIso(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Converte um Date para a data de calendário no fuso local do ambiente. */
export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Converte AAAA-MM-DD para um Date à meia-noite local (uso em telas). */
export function fromIsoDate(iso: IsoDate): Date {
  const ms = isoToUtcMs(iso);
  const utc = new Date(ms);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return utcMsToIso(isoToUtcMs(iso) + days * DAY_MS);
}

/** Dias corridos de `from` até `to` (positivo quando `to` é depois). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((isoToUtcMs(to) - isoToUtcMs(from)) / DAY_MS);
}

/** Dia da semana de 0 (domingo) a 6 (sábado). */
export function weekday(iso: IsoDate): number {
  return new Date(isoToUtcMs(iso)).getUTCDay();
}

export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minIsoDate(...dates: (IsoDate | null | undefined)[]): IsoDate | null {
  let result: IsoDate | null = null;
  for (const date of dates) if (date && (result === null || date < result)) result = date;
  return result;
}

export function maxIsoDate(...dates: (IsoDate | null | undefined)[]): IsoDate | null {
  let result: IsoDate | null = null;
  for (const date of dates) if (date && (result === null || date > result)) result = date;
  return result;
}

export function eachDay(start: IsoDate, end: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  const total = diffDays(start, end);
  for (let i = 0; i <= total; i += 1) days.push(addDays(start, i));
  return days;
}

/**
 * Calendário de trabalho: dias da semana úteis e feriados. As funções abaixo também
 * aceitam só a lista de dias da semana (sem feriados), por compatibilidade.
 */
export interface WorkCalendar {
  /** Dias úteis como números de 0 (domingo) a 6 (sábado). */
  workingDays: readonly number[];
  /** Datas que não são úteis mesmo caindo num dia útil da semana. */
  holidays?: ReadonlySet<IsoDate>;
}

export type CalendarInput = readonly number[] | WorkCalendar;

/** Calendário em que todo dia é útil (tarefa liberada para fins de semana e feriados). */
export const ALL_DAYS: WorkCalendar = { workingDays: [0, 1, 2, 3, 4, 5, 6] };

const NO_HOLIDAYS: ReadonlySet<IsoDate> = new Set();
// Teto de passos ao procurar dia útil: evita laço infinito se o calendário não tiver
// nenhum dia útil alcançável (por exemplo, todos os dias cadastrados como feriado).
const MAX_SEARCH = 3700;

interface Resolved {
  days: readonly number[];
  holidays: ReadonlySet<IsoDate>;
}

function resolve(calendar: CalendarInput): Resolved {
  const workingDays = 'workingDays' in calendar ? calendar.workingDays : calendar;
  const holidays = 'workingDays' in calendar ? (calendar.holidays ?? NO_HOLIDAYS) : NO_HOLIDAYS;
  // Um calendário sem dias úteis faria os laços abaixo nunca terminarem.
  return { days: workingDays.length > 0 ? workingDays : [0, 1, 2, 3, 4, 5, 6], holidays };
}

const open = (iso: IsoDate, calendar: Resolved) => calendar.days.includes(weekday(iso)) && !calendar.holidays.has(iso);

export function isWorkday(iso: IsoDate, calendar: CalendarInput): boolean {
  return open(iso, resolve(calendar));
}

export function isHoliday(iso: IsoDate, calendar: CalendarInput): boolean {
  return resolve(calendar).holidays.has(iso);
}

function seek(iso: IsoDate, step: 1 | -1, calendar: Resolved): IsoDate {
  let current = iso;
  for (let i = 0; i < MAX_SEARCH && !open(current, calendar); i += 1) current = addDays(current, step);
  return open(current, calendar) ? current : iso;
}

/** Próximo dia útil a partir de `iso`, inclusive. */
export function nextWorkday(iso: IsoDate, calendar: CalendarInput): IsoDate {
  return seek(iso, 1, resolve(calendar));
}

/** Dia útil anterior a `iso`, inclusive. */
export function previousWorkday(iso: IsoDate, calendar: CalendarInput): IsoDate {
  return seek(iso, -1, resolve(calendar));
}

/**
 * Anda `amount` dias úteis a partir de `iso`. Com amount 0 devolve o próprio dia
 * ajustado para dia útil. Aceita valores negativos.
 */
export function addWorkdays(iso: IsoDate, amount: number, calendar: CalendarInput): IsoDate {
  const resolved = resolve(calendar);
  const step = amount >= 0 ? 1 : -1;
  let current = seek(iso, step, resolved);
  let remaining = Math.abs(amount);
  let guard = 0;
  while (remaining > 0 && guard < MAX_SEARCH * 4) {
    current = addDays(current, step);
    if (open(current, resolved)) remaining -= 1;
    guard += 1;
  }
  return current;
}

/** Quantidade de dias úteis no intervalo fechado [start, end]. Zero se end < start. */
export function workdaysBetween(start: IsoDate, end: IsoDate, calendar: CalendarInput): number {
  if (end < start) return 0;
  const { days, holidays } = resolve(calendar);
  const total = diffDays(start, end) + 1;
  const fullWeeks = Math.floor(total / 7);
  let count = fullWeeks * days.length;
  const startWeekday = weekday(start);
  for (let i = 0; i < total % 7; i += 1) {
    if (days.includes((startWeekday + fullWeeks * 7 + i) % 7)) count += 1;
  }
  // Feriados só descontam quando caem num dia que seria útil.
  for (const holiday of holidays) {
    if (holiday >= start && holiday <= end && days.includes(weekday(holiday))) count -= 1;
  }
  return count;
}

/** Início da semana que contém `iso`, com a semana começando em `weekStart`. */
export function startOfWeekIso(iso: IsoDate, weekStart: number): IsoDate {
  const offset = (weekday(iso) - weekStart + 7) % 7;
  return addDays(iso, -offset);
}

/** Número da semana ISO 8601 (semana que contém a primeira quinta-feira do ano). */
export function isoWeekNumber(iso: IsoDate): number {
  const ms = isoToUtcMs(iso);
  const day = new Date(ms).getUTCDay() || 7;
  const thursday = new Date(ms + (4 - day) * DAY_MS);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.ceil(((thursday.getTime() - yearStart) / DAY_MS + 1) / 7);
}
