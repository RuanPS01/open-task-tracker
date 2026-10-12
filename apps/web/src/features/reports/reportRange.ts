// Períodos prontos dos relatórios e agregação das colunas do gráfico por dia,
// semana ou mês conforme o tamanho do período (para as barras não ficarem finas demais).
import { addDays, diffDays, startOfWeekIso, type IsoDate } from '@ott/shared';

export type Preset = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'last30' | 'thisYear';

export const PRESETS: Preset[] = ['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'last30', 'thisYear'];

function monthBounds(year: number, month: number): { start: IsoDate; end: IsoDate } {
  const start = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  return { start, end };
}

export function presetRange(preset: Preset, today: IsoDate, weekStart: number): { start: IsoDate; end: IsoDate } {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  switch (preset) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday':
      return { start: addDays(today, -1), end: addDays(today, -1) };
    case 'thisWeek': {
      const start = startOfWeekIso(today, weekStart);
      return { start, end: addDays(start, 6) };
    }
    case 'lastWeek': {
      const start = addDays(startOfWeekIso(today, weekStart), -7);
      return { start, end: addDays(start, 6) };
    }
    case 'thisMonth':
      return monthBounds(year, month);
    case 'lastMonth':
      return monthBounds(year, month - 1);
    case 'last30':
      return { start: addDays(today, -29), end: today };
    case 'thisYear':
      return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
}

export function matchPreset(start: IsoDate, end: IsoDate, today: IsoDate, weekStart: number): Preset | null {
  return PRESETS.find((preset) => {
    const range = presetRange(preset, today, weekStart);
    return range.start === start && range.end === end;
  }) ?? null;
}

/** Desloca o período pelo próprio tamanho (setas anterior e próximo). */
export function shiftRange(start: IsoDate, end: IsoDate, direction: 1 | -1): { start: IsoDate; end: IsoDate } {
  const isWholeMonth = start.endsWith('-01') && addDays(end, 1).endsWith('-01');
  if (isWholeMonth) {
    const year = Number(start.slice(0, 4));
    const month = Number(start.slice(5, 7)) - 1 + direction;
    return monthBounds(year, month);
  }
  const length = diffDays(start, end) + 1;
  return { start: addDays(start, direction * length), end: addDays(end, direction * length) };
}

export type Bucket = 'day' | 'week' | 'month';

export function bucketFor(start: IsoDate, end: IsoDate): Bucket {
  const days = diffDays(start, end) + 1;
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

export function bucketKey(date: IsoDate, bucket: Bucket, weekStart: number): IsoDate {
  if (bucket === 'week') return startOfWeekIso(date, weekStart);
  if (bucket === 'month') return `${date.slice(0, 7)}-01`;
  return date;
}

/** Soma linhas diárias em baldes, mantendo a ordem cronológica. */
export function aggregateDays<T extends { date: IsoDate; seconds: number; billableSeconds: number }>(
  rows: T[],
  bucket: Bucket,
  weekStart: number,
): { key: IsoDate; seconds: number; billableSeconds: number }[] {
  const map = new Map<IsoDate, { key: IsoDate; seconds: number; billableSeconds: number }>();
  for (const row of rows) {
    const key = bucketKey(row.date, bucket, weekStart);
    const current = map.get(key) ?? { key, seconds: 0, billableSeconds: 0 };
    current.seconds += row.seconds;
    current.billableSeconds += row.billableSeconds;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}
