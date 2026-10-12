// Modelo do Gantt: escala de tempo, linhas da árvore e geometria das setas.
// Tudo aqui é puro (sem React) para ser testado em ganttModel.test.ts.
import {
  addDays,
  compareIds,
  diffDays,
  isWorkday,
  isoToUtcMs,
  maxIsoDate,
  minIsoDate,
  startOfWeekIso,
  utcMsToIso,
  type CalendarInput,
  type DependencyType,
  type Id,
  type IsoDate,
} from '@ott/shared';

export type Zoom = 'days' | 'weeks' | 'months';

export const ZOOMS: Record<Zoom, { dayWidth: number; padBefore: number; padAfter: number }> = {
  days: { dayWidth: 36, padBefore: 7, padAfter: 21 },
  weeks: { dayWidth: 14, padBefore: 14, padAfter: 42 },
  months: { dayWidth: 4.5, padBefore: 31, padAfter: 120 },
};

export const ROW_HEIGHT = 36;
export const HEADER_HEIGHT = 52;

export interface GanttRange {
  start: IsoDate;
  end: IsoDate;
  days: number;
}

function startOfMonthIso(iso: IsoDate): IsoDate {
  return `${iso.slice(0, 7)}-01`;
}

/** Intervalo visível: cobre as tarefas, hoje e uma folga, alinhado a semana ou mês. */
export function computeRange(dates: (IsoDate | null)[], today: IsoDate, zoom: Zoom, weekStart = 1): GanttRange {
  const config = ZOOMS[zoom];
  const first = minIsoDate(today, ...dates) ?? today;
  const last = maxIsoDate(today, ...dates) ?? today;
  let start = addDays(first, -config.padBefore);
  start = zoom === 'months' ? startOfMonthIso(start) : startOfWeekIso(start, weekStart);
  const end = addDays(last, config.padAfter);
  return { start, end, days: diffDays(start, end) + 1 };
}

export const dateToX = (date: IsoDate, range: GanttRange, dayWidth: number) => diffDays(range.start, date) * dayWidth;

export function xToDate(x: number, range: GanttRange, dayWidth: number): IsoDate {
  return addDays(range.start, Math.floor(x / dayWidth));
}

// ---------------------------------------------------------------------------
// Cabeçalho em duas faixas
// ---------------------------------------------------------------------------

export interface HeaderCell {
  key: string;
  x: number;
  width: number;
  label: string;
  /** Data de referência da célula (para destacar hoje e fim de semana). */
  date: IsoDate;
}

export interface HeaderLabels {
  month: (iso: IsoDate) => string;
  monthShort: (iso: IsoDate) => string;
  year: (iso: IsoDate) => string;
  week: (iso: IsoDate) => string;
  day: (iso: IsoDate) => string;
}

function spans(range: GanttRange, dayWidth: number, startOf: (iso: IsoDate) => IsoDate, next: (iso: IsoDate) => IsoDate, label: (iso: IsoDate) => string): HeaderCell[] {
  const cells: HeaderCell[] = [];
  let cursor = startOf(range.start);
  while (cursor <= range.end) {
    const following = next(cursor);
    const from = cursor < range.start ? range.start : cursor;
    const to = following > addDays(range.end, 1) ? addDays(range.end, 1) : following;
    cells.push({
      key: cursor,
      x: dateToX(from, range, dayWidth),
      width: diffDays(from, to) * dayWidth,
      label: label(cursor),
      date: cursor,
    });
    cursor = following;
  }
  return cells;
}

const nextMonth = (iso: IsoDate) => {
  const date = new Date(isoToUtcMs(startOfMonthIso(iso)));
  date.setUTCMonth(date.getUTCMonth() + 1);
  return utcMsToIso(date.getTime());
};
const nextYear = (iso: IsoDate) => `${Number(iso.slice(0, 4)) + 1}-01-01`;

export function buildHeader(range: GanttRange, zoom: Zoom, labels: HeaderLabels, weekStart = 1): { top: HeaderCell[]; bottom: HeaderCell[] } {
  const { dayWidth } = ZOOMS[zoom];
  if (zoom === 'months') {
    return {
      top: spans(range, dayWidth, (iso) => `${iso.slice(0, 4)}-01-01`, nextYear, labels.year),
      bottom: spans(range, dayWidth, startOfMonthIso, nextMonth, labels.monthShort),
    };
  }
  if (zoom === 'weeks') {
    return {
      top: spans(range, dayWidth, startOfMonthIso, nextMonth, labels.month),
      bottom: spans(range, dayWidth, (iso) => startOfWeekIso(iso, weekStart), (iso) => addDays(iso, 7), labels.week),
    };
  }
  return {
    top: spans(range, dayWidth, (iso) => startOfWeekIso(iso, weekStart), (iso) => addDays(iso, 7), labels.week),
    bottom: spans(range, dayWidth, (iso) => iso, (iso) => addDays(iso, 1), labels.day),
  };
}

/** Dias não úteis visíveis (fins de semana e feriados), para sombrear colunas. */
export function nonWorkingDays(range: GanttRange, calendar: CalendarInput): IsoDate[] {
  const result: IsoDate[] = [];
  for (let i = 0; i < range.days; i += 1) {
    const day = addDays(range.start, i);
    if (!isWorkday(day, calendar)) result.push(day);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Linhas (árvore achatada)
// ---------------------------------------------------------------------------

export interface TreeTask {
  id: Id;
  parentId: Id | null;
  position: number;
}

export interface GanttRow<T extends TreeTask> {
  task: T;
  depth: number;
  hasChildren: boolean;
  /** Numeração hierárquica (1, 1.2, 1.2.3), como no MS Project. */
  wbs: string;
}

/**
 * Achata a árvore em ordem de exibição. Tarefas cujo pai não está na lista (por
 * exemplo, de outro projeto) viram raiz. Pais recolhidos escondem a subárvore.
 */
export function buildRows<T extends TreeTask>(tasks: T[], collapsed: ReadonlySet<Id>): GanttRow<T>[] {
  const ids = new Set(tasks.map((task) => task.id));
  const children = new Map<Id | null, T[]>();
  for (const task of tasks) {
    const parent = task.parentId !== null && ids.has(task.parentId) ? task.parentId : null;
    const list = children.get(parent) ?? [];
    list.push(task);
    children.set(parent, list);
  }
  for (const list of children.values()) list.sort((a, b) => a.position - b.position || compareIds(a.id, b.id));

  const rows: GanttRow<T>[] = [];
  const visit = (parent: Id | null, depth: number, prefix: string, hidden: boolean, seen: Set<Id>) => {
    (children.get(parent) ?? []).forEach((task, index) => {
      if (seen.has(task.id)) return;
      seen.add(task.id);
      const wbs = prefix ? `${prefix}.${index + 1}` : String(index + 1);
      const hasChildren = (children.get(task.id)?.length ?? 0) > 0;
      if (!hidden) rows.push({ task, depth, hasChildren, wbs });
      visit(task.id, depth + 1, wbs, hidden || collapsed.has(task.id), seen);
    });
  };
  visit(null, 0, '', false, new Set());
  return rows;
}

// ---------------------------------------------------------------------------
// Setas de dependência
// ---------------------------------------------------------------------------

export interface BarBox {
  x1: number;
  x2: number;
  y: number;
}

/**
 * Caminho SVG da seta. Sai do lado certo da predecessora (fim em FS/FF, início em
 * SS/SF), contorna com cotovelos e entra pelo lado certo da sucessora.
 */
export function dependencyPath(type: DependencyType, from: BarBox, to: BarBox, rowHeight = ROW_HEIGHT): string {
  const gap = 10;
  const fromEnd = type === 'FS' || type === 'FF';
  const toStart = type === 'FS' || type === 'SS';
  const sx = fromEnd ? from.x2 : from.x1;
  const tx = toStart ? to.x1 : to.x2;
  const exit = sx + (fromEnd ? gap : -gap);
  const approach = tx + (toStart ? -gap : gap);
  const sy = from.y;
  const ty = to.y;
  if (toStart && fromEnd && exit <= approach) {
    return `M ${sx} ${sy} H ${exit} V ${ty} H ${tx}`;
  }
  const midY = ty === sy ? sy + rowHeight / 2 : sy + Math.sign(ty - sy) * (rowHeight / 2);
  return `M ${sx} ${sy} H ${exit} V ${midY} H ${approach} V ${ty} H ${tx}`;
}
