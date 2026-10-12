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

// Um calendário sem dias úteis faria os laços abaixo nunca terminarem.
function safeWorkingDays(workingDays: readonly number[]): readonly number[] {
  return workingDays.length > 0 ? workingDays : [0, 1, 2, 3, 4, 5, 6];
}

export function isWorkday(iso: IsoDate, workingDays: readonly number[]): boolean {
  return safeWorkingDays(workingDays).includes(weekday(iso));
}

/** Próximo dia útil a partir de `iso`, inclusive. */
export function nextWorkday(iso: IsoDate, workingDays: readonly number[]): IsoDate {
  const days = safeWorkingDays(workingDays);
  let current = iso;
  while (!days.includes(weekday(current))) current = addDays(current, 1);
  return current;
}

/** Dia útil anterior a `iso`, inclusive. */
export function previousWorkday(iso: IsoDate, workingDays: readonly number[]): IsoDate {
  const days = safeWorkingDays(workingDays);
  let current = iso;
  while (!days.includes(weekday(current))) current = addDays(current, -1);
  return current;
}

/**
 * Anda `amount` dias úteis a partir de `iso`. Com amount 0 devolve o próprio dia
 * ajustado para dia útil. Aceita valores negativos.
 */
export function addWorkdays(iso: IsoDate, amount: number, workingDays: readonly number[]): IsoDate {
  const days = safeWorkingDays(workingDays);
  const step = amount >= 0 ? 1 : -1;
  let current = step > 0 ? nextWorkday(iso, days) : previousWorkday(iso, days);
  let remaining = Math.abs(amount);
  while (remaining > 0) {
    current = addDays(current, step);
    if (days.includes(weekday(current))) remaining -= 1;
  }
  return current;
}

/** Quantidade de dias úteis no intervalo fechado [start, end]. Zero se end < start. */
export function workdaysBetween(
  start: IsoDate,
  end: IsoDate,
  workingDays: readonly number[],
): number {
  if (end < start) return 0;
  const days = safeWorkingDays(workingDays);
  const total = diffDays(start, end) + 1;
  const fullWeeks = Math.floor(total / 7);
  let count = fullWeeks * days.length;
  const startWeekday = weekday(start);
  for (let i = 0; i < total % 7; i += 1) {
    if (days.includes((startWeekday + fullWeeks * 7 + i) % 7)) count += 1;
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
