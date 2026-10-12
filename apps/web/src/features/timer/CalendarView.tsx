// Visão Calendário do cronômetro. Interações (todas por ponteiro, sem biblioteca):
// - clicar e arrastar no vazio cria um apontamento no intervalo;
// - arrastar um apontamento move (inclusive para outro dia);
// - arrastar a borda de baixo muda o fim;
// - clicar abre o editor.
import { formatClock, toIsoDate, type Id, type Project, type TimeEntry } from '@ott/shared';
import clsx from 'clsx';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useNow } from '../../lib/hooks';
import { layoutDay, segmentForDay, snapMinutes } from './calendarLayout';
import styles from './CalendarView.module.css';

const HOUR_HEIGHT = 52;
const PX_PER_MIN = HOUR_HEIGHT / 60;
const DAY_MINUTES = 24 * 60;
const DRAG_THRESHOLD = 4;

type DragState =
  | { kind: 'create'; dayIndex: number; anchorMin: number; currentMin: number }
  | {
      kind: 'move' | 'resize';
      entry: TimeEntry;
      originDay: number;
      pointerStartY: number;
      pointerStartX: number;
      deltaMin: number;
      dayDelta: number;
      moved: boolean;
    };

export interface CalendarViewProps {
  days: Date[];
  entries: TimeEntry[];
  projects: Map<Id, Project>;
  totals: Map<string, number>;
  holidayNames?: Map<string, string>;
  onOpen: (entry: TimeEntry) => void;
  onCreate: (start: Date, end: Date) => void;
  onChangeTimes: (entry: TimeEntry, start: Date, end: Date) => void;
}

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export function CalendarView({ days, entries, projects, totals, holidayNames, onOpen, onCreate, onChangeTimes }: CalendarViewProps) {
  const t = useT();
  const format = useFormat();
  const now = useNow(30_000);
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  // Abre o calendário perto do horário atual (ou às 8h), como o Toggl faz.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const hour = Math.max(0, Math.min(new Date().getHours() - 2, 8));
    element.scrollTop = hour * HOUR_HEIGHT;
  }, []);

  const segmentsByDay = useMemo(
    () =>
      days.map((day) => {
        const segments = [];
        const lookup = new Map<Id, TimeEntry>();
        for (const entry of entries) {
          const end = entry.stop ? new Date(entry.stop) : now;
          const segment = segmentForDay(entry.id, new Date(entry.start), end, day);
          if (segment) {
            segments.push(segment);
            lookup.set(entry.id, entry);
          }
        }
        return layoutDay(segments).map((placed) => ({ ...placed, entry: lookup.get(placed.id)! }));
      }),
    [days, entries, now],
  );

  const minuteFromEvent = (event: { clientY: number }, column: HTMLElement) => {
    const rect = column.getBoundingClientRect();
    return Math.max(0, Math.min(DAY_MINUTES, (event.clientY - rect.top) / PX_PER_MIN));
  };

  const dayIndexFromX = (clientX: number) => {
    const container = columnsRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const index = Math.floor(((clientX - rect.left) / rect.width) * days.length);
    return Math.max(0, Math.min(days.length - 1, index));
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      if (current.kind === 'create') {
        const column = columnsRef.current?.children[current.dayIndex] as HTMLElement | undefined;
        if (!column) return;
        setDrag({ ...current, currentMin: snapMinutes(minuteFromEvent(event, column)) });
        return;
      }
      const dy = event.clientY - current.pointerStartY;
      const dx = event.clientX - current.pointerStartX;
      const moved = current.moved || Math.abs(dy) > DRAG_THRESHOLD || Math.abs(dx) > DRAG_THRESHOLD;
      const deltaMin = snapMinutes(dy / PX_PER_MIN);
      const dayDelta = current.kind === 'move' ? dayIndexFromX(event.clientX) - current.originDay : 0;
      setDrag({ ...current, deltaMin, dayDelta, moved });
    };
    const onUp = () => {
      const current = dragRef.current;
      setDrag(null);
      if (!current) return;
      if (current.kind === 'create') {
        const day = days[current.dayIndex]!;
        let startMin = Math.min(current.anchorMin, current.currentMin);
        let endMin = Math.max(current.anchorMin, current.currentMin);
        // Clique simples (sem arrastar) cria um bloco de 30 minutos.
        if (endMin - startMin < 15) {
          startMin = current.anchorMin;
          endMin = Math.min(DAY_MINUTES, startMin + 30);
        }
        onCreate(new Date(day.getTime() + startMin * 60_000), new Date(day.getTime() + endMin * 60_000));
        return;
      }
      if (!current.moved) {
        onOpen(current.entry);
        return;
      }
      const start = new Date(current.entry.start);
      const end = new Date(current.entry.stop!);
      if (current.kind === 'move') {
        const shift = current.deltaMin * 60_000;
        const newStart = new Date(start.getTime() + shift);
        newStart.setDate(newStart.getDate() + current.dayDelta);
        onChangeTimes(current.entry, newStart, new Date(newStart.getTime() + (end.getTime() - start.getTime())));
      } else {
        const newEnd = new Date(Math.max(start.getTime() + 5 * 60_000, end.getTime() + current.deltaMin * 60_000));
        onChangeTimes(current.entry, start, newEnd);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // O efeito só precisa reagir ao início e ao fim do arraste.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag === null]);

  const startCreate = (event: ReactPointerEvent<HTMLDivElement>, dayIndex: number) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    event.preventDefault();
    const minute = snapMinutes(minuteFromEvent(event, event.currentTarget), 15);
    setDrag({ kind: 'create', dayIndex, anchorMin: minute, currentMin: minute });
  };

  const startEntryDrag = (event: ReactPointerEvent, entry: TimeEntry, dayIndex: number, kind: 'move' | 'resize') => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    if (entry.stop === null) {
      onOpen(entry);
      return;
    }
    setDrag({
      kind,
      entry,
      originDay: dayIndex,
      pointerStartY: event.clientY,
      pointerStartX: event.clientX,
      deltaMin: 0,
      dayDelta: 0,
      moved: false,
    });
  };

  const today = dayKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const hours = Array.from({ length: 24 }, (_, hour) => hour);

  return (
    <div className={styles.calendar}>
      <div className={styles.head}>
        <div className={styles.gutterHead} />
        {days.map((day) => {
          const total = totals.get(dayKey(day)) ?? 0;
          const isToday = dayKey(day) === today;
          const holiday = holidayNames?.get(toIsoDate(day));
          return (
            <div key={day.toISOString()} className={styles.dayHead} title={holiday ? t.gantt.holiday(holiday) : undefined}>
              <span className={clsx(styles.dayNumber, isToday && styles.today)}>{day.getDate()}</span>
              <span className={styles.dayMeta}>
                <span className={styles.dayName}>{format.weekdayShort(day)}</span>
                <span className={styles.dayTotal}>
                  {total > 0 ? formatClock(total) : '-'}
                  {holiday && <span className={styles.holidayTag}>{holiday}</span>}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <div className={styles.scroll} ref={scrollRef}>
        <div className={styles.grid} style={{ height: 24 * HOUR_HEIGHT }}>
          <div className={styles.gutter}>
            {hours.map((hour) =>
              hour === 0 ? null : (
                <span key={hour} className={styles.hourLabel} style={{ top: hour * HOUR_HEIGHT }}>
                  {format.hour(new Date(2000, 0, 1, hour))}
                </span>
              ),
            )}
          </div>
          <div className={styles.columns} ref={columnsRef}>
            {days.map((day, dayIndex) => {
              const isToday = dayKey(day) === today;
              const create = drag?.kind === 'create' && drag.dayIndex === dayIndex ? drag : null;
              return (
                <div
                  key={day.toISOString()}
                  className={styles.column}
                  style={{ backgroundSize: `100% ${HOUR_HEIGHT}px` }}
                  onPointerDown={(event) => startCreate(event, dayIndex)}
                >
                  {segmentsByDay[dayIndex]!.map((segment) => {
                    const { entry } = segment;
                    const project = entry.projectId ? projects.get(entry.projectId) : undefined;
                    const color = project?.color ?? 'var(--text-muted)';
                    const dragging = drag && drag.kind !== 'create' && drag.entry.id === entry.id && drag.moved;
                    const height = Math.max(16, (segment.endMin - segment.startMin) * PX_PER_MIN - 2);
                    const width = 100 / segment.columns;
                    return (
                      <div
                        key={`${entry.id}-${dayIndex}`}
                        className={clsx(styles.entry, entry.stop === null && styles.running, dragging && styles.ghosted)}
                        style={{
                          top: segment.startMin * PX_PER_MIN + 1,
                          height,
                          left: `calc(${segment.column * width}% + 2px)`,
                          width: `calc(${width}% - 4px)`,
                          ['--entry-color' as string]: color,
                        }}
                        onPointerDown={(event) => startEntryDrag(event, entry, dayIndex, 'move')}
                        title={`${entry.description || t.timer.noDescription} (${formatClock(entry.duration)})`}
                      >
                        <span className={styles.entryTitle}>{entry.description || t.timer.noDescription}</span>
                        {height > 34 && project && <span className={styles.entryProject}>{project.name}</span>}
                        {height > 52 && (
                          <span className={styles.entryTime}>
                            {format.time(entry.start)} - {entry.stop ? format.time(entry.stop) : ''}
                          </span>
                        )}
                        {entry.stop !== null && (
                          <span
                            className={styles.resize}
                            onPointerDown={(event) => startEntryDrag(event, entry, dayIndex, 'resize')}
                          />
                        )}
                      </div>
                    );
                  })}

                  {drag && drag.kind !== 'create' && drag.moved && (() => {
                    const start = new Date(drag.entry.start);
                    const end = new Date(drag.entry.stop!);
                    const targetDay = drag.originDay + drag.dayDelta;
                    if (targetDay !== dayIndex) return null;
                    const startMin =
                      (start.getTime() - days[drag.originDay]!.getTime()) / 60_000 + (drag.kind === 'move' ? drag.deltaMin : 0);
                    const length = (end.getTime() - start.getTime()) / 60_000 + (drag.kind === 'resize' ? drag.deltaMin : 0);
                    const project = drag.entry.projectId ? projects.get(drag.entry.projectId) : undefined;
                    return (
                      <div
                        className={clsx(styles.entry, styles.preview)}
                        style={{
                          top: startMin * PX_PER_MIN,
                          height: Math.max(16, length * PX_PER_MIN),
                          left: 2,
                          right: 2,
                          ['--entry-color' as string]: project?.color ?? 'var(--text-muted)',
                        }}
                      >
                        <span className={styles.entryTitle}>{drag.entry.description || t.timer.noDescription}</span>
                        <span className={styles.entryTime}>{formatClock(Math.max(0, length * 60))}</span>
                      </div>
                    );
                  })()}

                  {create && (
                    <div
                      className={clsx(styles.entry, styles.preview, styles.creating)}
                      style={{
                        top: Math.min(create.anchorMin, create.currentMin) * PX_PER_MIN,
                        height: Math.max(8, Math.abs(create.currentMin - create.anchorMin) * PX_PER_MIN),
                        left: 2,
                        right: 2,
                      }}
                    >
                      <span className={styles.entryTime}>{formatClock(Math.abs(create.currentMin - create.anchorMin) * 60)}</span>
                    </div>
                  )}

                  {isToday && (
                    <div className={styles.nowLine} style={{ top: nowMinutes * PX_PER_MIN }}>
                      <span className={styles.nowDot} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
