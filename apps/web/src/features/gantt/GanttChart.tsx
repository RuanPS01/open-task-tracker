// Gráfico de Gantt do projeto.
// Interações na linha do tempo:
// - arrastar a barra move a tarefa; arrastar as bordas muda início ou fim;
// - arrastar a bolinha da ponta até outra barra cria dependência término-início;
// - clicar numa seta remove a dependência (com confirmação);
// - clicar numa linha sem datas agenda a tarefa no dia clicado.
// Durante o arraste a cascata é simulada na tela (mesma função da camada de dados), então
// as sucessoras andam junto antes mesmo de gravar.
import {
  addDays,
  addWorkdays,
  calendarFor,
  cascadeSchedule,
  computeCriticalPath,
  isWorkday,
  nextWorkday,
  previousWorkday,
  rollupSummaries,
  toIsoDate,
  workdayDuration,
  type DateChange,
  type Id,
  type IsoDate,
  type Member,
  type Project,
  type Task,
  type TaskDependency,
  type WorkCalendar,
} from '@ott/shared';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { AvatarStack } from '../../components/ui/Avatar';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import {
  buildHeader,
  buildRows,
  computeRange,
  dateToX,
  dependencyPath,
  HEADER_HEIGHT,
  nonWorkingDays,
  ROW_HEIGHT,
  xToDate,
  ZOOMS,
  type BarBox,
  type Zoom,
} from './ganttModel';
import styles from './GanttChart.module.css';

type Drag =
  | { kind: 'move' | 'start' | 'end'; taskId: Id; originX: number; deltaDays: number; moved: boolean }
  | { kind: 'link'; fromId: Id; x: number; y: number; targetId: Id | null };

export interface GanttChartProps {
  tasks: Task[];
  dependencies: TaskDependency[];
  projects: Map<Id, Project>;
  members: Map<Id, Member>;
  zoom: Zoom;
  showCritical: boolean;
  autoSchedule: boolean;
  calendar: WorkCalendar;
  holidayNames: Map<IsoDate, string>;
  weekStart: number;
  collapsed: ReadonlySet<Id>;
  compactGrid: boolean;
  todaySignal: number;
  onToggleCollapse: (id: Id) => void;
  onOpenTask: (id: Id) => void;
  onSchedule: (updates: DateChange[]) => void;
  onCreateDependency: (predecessorId: Id, successorId: Id) => void;
  onDeleteDependency: (dependency: TaskDependency) => void;
  onQuickAdd: (name: string) => void;
}

const BAR_HEIGHT = 20;
const SUMMARY_HEIGHT = 8;
const DRAG_THRESHOLD = 3;

export function GanttChart(props: GanttChartProps) {
  const { tasks, dependencies, projects, members, zoom, showCritical, autoSchedule, calendar, holidayNames, weekStart, collapsed, compactGrid } = props;
  const t = useT();
  const format = useFormat();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  const [quickName, setQuickName] = useState('');
  const today = toIsoDate(new Date());
  const { dayWidth } = ZOOMS[zoom];

  // Datas exibidas: as reais ou a prévia do arraste com a cascata aplicada.
  const preview = useMemo(() => {
    if (!drag || drag.kind === 'link' || !drag.moved || drag.deltaDays === 0) return { tasks, changes: [] as DateChange[] };
    const task = tasks.find((item) => item.id === drag.taskId);
    if (!task?.startDate || !task.dueDate) return { tasks, changes: [] };
    // O arraste encaixa em dias úteis: mover preserva a duração em dias úteis, e
    // as bordas nunca param num fim de semana.
    const shifted = (date: string) => addDays(date, drag.deltaDays);
    // Tarefa liberada para fins de semana e feriados encaixa em qualquer dia.
    const taskCalendar = calendarFor(task, calendar);
    const snapForward = (date: string) => (isWorkday(date, taskCalendar) ? date : nextWorkday(date, taskCalendar));
    const snapBack = (date: string) => (isWorkday(date, taskCalendar) ? date : previousWorkday(date, taskCalendar));
    let startDate = task.startDate;
    let dueDate = task.dueDate;
    if (drag.kind === 'move' || task.isMilestone) {
      const duration = workdayDuration(task, calendar);
      startDate = drag.deltaDays > 0 ? snapForward(shifted(startDate)) : snapBack(shifted(startDate));
      dueDate = task.isMilestone ? startDate : addWorkdays(startDate, Math.max(1, duration) - 1, taskCalendar);
    } else if (drag.kind === 'start') {
      startDate = snapForward(shifted(startDate));
      if (startDate > dueDate) startDate = dueDate;
    } else {
      dueDate = snapBack(shifted(dueDate));
      if (dueDate < startDate) dueDate = startDate;
    }
    let next = tasks.map((item) => (item.id === task.id ? { ...item, startDate, dueDate } : item));
    const changes: DateChange[] = [{ id: task.id, startDate, dueDate }];
    if (autoSchedule) {
      const cascade = cascadeSchedule(next, dependencies, calendar).filter((change) => change.id !== task.id);
      const byId = new Map(cascade.map((change) => [change.id, change]));
      next = next.map((item) => {
        const change = byId.get(item.id);
        return change ? { ...item, startDate: change.startDate, dueDate: change.dueDate } : item;
      });
      changes.push(...cascade);
    }
    return { tasks: next, changes };
  }, [drag, tasks, dependencies, autoSchedule, calendar]);

  const shownTasks = preview.tasks;
  const summaries = useMemo(() => rollupSummaries(shownTasks), [shownTasks]);
  const critical = useMemo(
    () => (showCritical ? computeCriticalPath(shownTasks, dependencies, calendar) : null),
    [showCritical, shownTasks, dependencies, calendar],
  );
  const rows = useMemo(() => buildRows(shownTasks, collapsed), [shownTasks, collapsed]);

  const datesOf = (task: Task) => {
    const summary = summaries.get(task.id);
    return summary ? { startDate: summary.startDate, dueDate: summary.dueDate, progress: summary.progress } : task;
  };

  // A escala só muda quando os dados mudam, não durante o arraste.
  const range = useMemo(
    () => computeRange(tasks.flatMap((task) => [task.startDate, task.dueDate]), today, zoom, weekStart),
    [tasks, today, zoom, weekStart],
  );
  const header = useMemo(
    () =>
      buildHeader(
        range,
        zoom,
        {
          month: (iso) => format.yearMonth(iso),
          monthShort: (iso) => format.monthShort(iso),
          year: (iso) => iso.slice(0, 4),
          week: (iso) => (zoom === 'days' ? `${format.dayMonth(iso)} · ${t.timer.weekShort}${format.week(iso)}` : `${t.timer.weekShort}${format.week(iso)}`),
          day: (iso) => String(Number(iso.slice(8))),
        },
        weekStart,
      ),
    [range, zoom, format, t, weekStart],
  );
  const weekend = useMemo(() => (zoom === 'months' ? [] : nonWorkingDays(range, calendar)), [range, zoom, calendar]);
  const timelineWidth = range.days * dayWidth;
  const bodyHeight = Math.max(rows.length + 1, 6) * ROW_HEIGHT;

  // Caixas das barras por tarefa, para desenhar as setas.
  const boxes = useMemo(() => {
    const map = new Map<Id, BarBox>();
    rows.forEach((row, index) => {
      const dates = datesOf(row.task);
      if (!dates.startDate || !dates.dueDate) return;
      const y = index * ROW_HEIGHT + ROW_HEIGHT / 2;
      if (row.task.isMilestone && !row.hasChildren) {
        const cx = dateToX(dates.startDate, range, dayWidth) + dayWidth / 2;
        map.set(row.task.id, { x1: cx - 7, x2: cx + 7, y });
      } else {
        map.set(row.task.id, {
          x1: dateToX(dates.startDate, range, dayWidth),
          x2: dateToX(addDays(dates.dueDate, 1), range, dayWidth),
          y,
        });
      }
    });
    return map;
    // datesOf depende só de summaries, já listado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, summaries, range, dayWidth]);

  const scrollToToday = () => {
    const element = scrollerRef.current;
    if (!element) return;
    const gridWidth = compactGrid ? 280 : 520;
    element.scrollLeft = Math.max(0, dateToX(today, range, dayWidth) - (element.clientWidth - gridWidth) / 3);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(scrollToToday, [props.todaySignal, zoom]);

  const timelineX = (clientX: number) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    return rect ? clientX - rect.left : 0;
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      if (current.kind === 'link') {
        const rect = timelineRef.current?.getBoundingClientRect();
        const target = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-task-id]');
        const targetId = target?.dataset.taskId ?? null;
        setDrag({
          ...current,
          x: rect ? event.clientX - rect.left : 0,
          y: rect ? event.clientY - rect.top : 0,
          targetId: targetId !== current.fromId ? targetId : null,
        });
        return;
      }
      const dx = event.clientX - current.originX;
      setDrag({ ...current, deltaDays: Math.round(dx / dayWidth), moved: current.moved || Math.abs(dx) > DRAG_THRESHOLD });
    };
    const onUp = () => {
      const current = dragRef.current;
      setDrag(null);
      if (!current) return;
      if (current.kind === 'link') {
        if (current.targetId !== null) props.onCreateDependency(current.fromId, current.targetId);
        return;
      }
      if (!current.moved) {
        props.onOpenTask(current.taskId);
        return;
      }
      if (preview.changes.length > 0) props.onSchedule(preview.changes);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // Reinscreve quando muda a prévia para o pointerup gravar a versão atual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null, preview]);

  const beginDrag = (event: ReactPointerEvent, taskId: Id, kind: 'move' | 'start' | 'end') => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    setDrag({ kind, taskId, originX: event.clientX, deltaDays: 0, moved: false });
  };

  const beginLink = (event: ReactPointerEvent, taskId: Id) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    setDrag({ kind: 'link', fromId: taskId, x: timelineX(event.clientX), y: 0, targetId: null });
  };

  const scheduleUnscheduled = (event: ReactPointerEvent, task: Task, hasChildren: boolean) => {
    if (hasChildren || task.startDate || task.dueDate || event.button !== 0) return;
    const start = xToDate(timelineX(event.clientX), range, dayWidth);
    const days = task.isMilestone ? 1 : Math.max(1, Math.ceil((task.estimateSeconds ?? 0) / (8 * 3600)));
    const dueDate = task.isMilestone ? start : addWorkdays(start, days - 1, calendarFor(task, calendar));
    props.onSchedule([{ id: task.id, startDate: start, dueDate }]);
  };

  const gridWidth = compactGrid ? 280 : 520;
  const todayX = dateToX(today, range, dayWidth);
  const linkFrom = drag?.kind === 'link' ? boxes.get(drag.fromId) : undefined;

  return (
    <div className={styles.scroller} ref={scrollerRef}>
      <div className={styles.inner} style={{ width: gridWidth + timelineWidth }}>
        {/* Cabeçalho fixo no topo */}
        <div className={styles.headerRow} style={{ height: HEADER_HEIGHT }}>
          <div className={clsx(styles.gridHeader, compactGrid && styles.compact)} style={{ width: gridWidth }}>
            <span className={styles.colName}>{t.gantt.colName}</span>
            {!compactGrid && (
              <>
                <span className={styles.colDate}>{t.gantt.colStart}</span>
                <span className={styles.colDate}>{t.gantt.colEnd}</span>
                <span className={styles.colDuration}>{t.gantt.colDuration}</span>
                <span className={styles.colPeople}>{t.gantt.colAssignees}</span>
                <span className={styles.colProgress}>{t.gantt.colProgress}</span>
              </>
            )}
          </div>
          <div className={styles.timelineHeader} style={{ width: timelineWidth }}>
            <div className={styles.tier}>
              {header.top.map((cell) => (
                <span key={cell.key} className={styles.tierCell} style={{ left: cell.x, width: cell.width }}>
                  {cell.label}
                </span>
              ))}
            </div>
            <div className={styles.tier}>
              {header.bottom.map((cell) => (
                <span
                  key={cell.key}
                  className={clsx(
                    styles.tierCell,
                    styles.tierBottom,
                    zoom === 'days' && holidayNames.has(cell.date) && styles.tierHoliday,
                    zoom === 'days' && cell.date === today && styles.tierToday,
                  )}
                  title={zoom === 'days' && holidayNames.has(cell.date) ? t.gantt.holiday(holidayNames.get(cell.date)!) : undefined}
                  style={{ left: cell.x, width: cell.width }}
                >
                  {cell.width >= 18 ? cell.label : ''}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.bodyRow}>
          {/* Grade à esquerda, presa ao rolar para os lados */}
          <div className={styles.grid} style={{ width: gridWidth, height: bodyHeight }}>
            {rows.map((row) => {
              const dates = datesOf(row.task);
              const project = row.task.projectId ? projects.get(row.task.projectId) : undefined;
              const duration =
                dates.startDate && dates.dueDate ? workdayDuration({ ...dates, isMilestone: row.task.isMilestone && !row.hasChildren, allowNonWorkingDays: row.task.allowNonWorkingDays }, calendar) : null;
              const assignees = row.task.assigneeIds
                .map((id) => members.get(id))
                .filter((member): member is Member => Boolean(member))
                .map((member) => ({ id: member.userId, name: member.name, avatarColor: member.avatarColor }));
              return (
                <div
                  key={row.task.id}
                  className={clsx(styles.gridRow, row.hasChildren && styles.summaryRow, compactGrid && styles.compact)}
                  data-task-id={row.task.id}
                  onClick={() => props.onOpenTask(row.task.id)}
                >
                  <span className={styles.colName} style={{ paddingLeft: 8 + row.depth * 16 }}>
                    {row.hasChildren ? (
                      <button
                        type="button"
                        className={styles.toggle}
                        onClick={(event) => {
                          event.stopPropagation();
                          props.onToggleCollapse(row.task.id);
                        }}
                        aria-label={collapsed.has(row.task.id) ? t.gantt.expandAll : t.gantt.collapseAll}
                      >
                        {collapsed.has(row.task.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      </button>
                    ) : (
                      <span className={styles.toggleSpacer} style={{ background: project?.color }} />
                    )}
                    <span className={styles.wbs}>{row.wbs}</span>
                    <span className={clsx(styles.taskName, row.task.status === 'done' && styles.done)}>{row.task.name}</span>
                  </span>
                  {!compactGrid && (
                    <>
                      <span className={styles.colDate}>{dates.startDate ? format.dayMonth(dates.startDate) : ''}</span>
                      <span className={styles.colDate}>{dates.dueDate ? format.dayMonth(dates.dueDate) : ''}</span>
                      <span className={styles.colDuration}>{duration !== null ? t.gantt.durationDays(duration) : ''}</span>
                      <span className={styles.colPeople}>{assignees.length > 0 && <AvatarStack people={assignees} size={20} max={2} />}</span>
                      <span className={styles.colProgress}>{dates.progress}%</span>
                    </>
                  )}
                </div>
              );
            })}
            <div className={styles.quickAdd}>
              <Plus size={14} />
              <input
                value={quickName}
                placeholder={t.tasks.quickAdd}
                onChange={(event) => setQuickName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && quickName.trim()) {
                    props.onQuickAdd(quickName.trim());
                    setQuickName('');
                  }
                }}
              />
            </div>
          </div>

          {/* Linha do tempo */}
          <div ref={timelineRef} className={styles.timeline} style={{ width: timelineWidth, height: bodyHeight }}>
            {weekend.map((day) => {
              const holiday = holidayNames.get(day);
              return (
                <div
                  key={day}
                  className={holiday ? styles.holiday : styles.weekend}
                  style={{ left: dateToX(day, range, dayWidth), width: dayWidth }}
                  title={holiday ? t.gantt.holiday(holiday) : undefined}
                />
              );
            })}
            {rows.map((row, index) => (
              <div
                key={row.task.id}
                className={clsx(styles.lane, !row.hasChildren && !row.task.startDate && !row.task.dueDate && styles.laneEmpty)}
                style={{ top: index * ROW_HEIGHT }}
                data-task-id={row.task.id}
                data-hint={t.gantt.unscheduled}
                onPointerDown={(event) => scheduleUnscheduled(event, row.task, row.hasChildren)}
              />
            ))}
            <div className={styles.today} style={{ left: todayX + dayWidth / 2 }} />

            <svg className={styles.links} width={timelineWidth} height={bodyHeight}>
              <defs>
                <marker id="gantt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L8,4 L0,8 z" fill="var(--gantt-dependency)" />
                </marker>
                <marker id="gantt-arrow-critical" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L8,4 L0,8 z" fill="var(--gantt-critical)" />
                </marker>
              </defs>
              {dependencies.map((dependency) => {
                const from = boxes.get(dependency.predecessorId);
                const to = boxes.get(dependency.successorId);
                if (!from || !to) return null;
                const isCritical =
                  critical !== null &&
                  critical.criticalTaskIds.has(dependency.predecessorId) &&
                  critical.criticalTaskIds.has(dependency.successorId);
                const path = dependencyPath(dependency.type, from, to);
                return (
                  <g key={dependency.id} className={styles.link} onClick={() => props.onDeleteDependency(dependency)}>
                    <title>{`${t.tasks.dependencyTypes[dependency.type]}${dependency.lagDays ? ` (+${dependency.lagDays})` : ''} · ${t.gantt.removeDependency}`}</title>
                    <path d={path} className={styles.linkHit} />
                    <path
                      d={path}
                      className={clsx(styles.linkPath, isCritical && styles.linkCritical)}
                      markerEnd={`url(#${isCritical ? 'gantt-arrow-critical' : 'gantt-arrow'})`}
                    />
                  </g>
                );
              })}
              {drag?.kind === 'link' && linkFrom && (
                <line x1={linkFrom.x2} y1={linkFrom.y} x2={drag.x} y2={drag.y} className={styles.linkDraft} />
              )}
            </svg>

            {rows.map((row, index) => {
              const dates = datesOf(row.task);
              if (!dates.startDate || !dates.dueDate) return null;
              const box = boxes.get(row.task.id)!;
              const project = row.task.projectId ? projects.get(row.task.projectId) : undefined;
              const color = project?.color ?? 'var(--accent)';
              const isCritical = critical?.criticalTaskIds.has(row.task.id) ?? false;
              const float = critical?.floatByTask.get(row.task.id);
              const dragging = drag && drag.kind !== 'link' && drag.taskId === row.task.id && drag.moved;
              const isTarget = drag?.kind === 'link' && drag.targetId === row.task.id;
              const top = index * ROW_HEIGHT;
              const tooltip = [
                row.task.name,
                dates.startDate === dates.dueDate ? format.dayLabel(dates.startDate) : format.range(dates.startDate, dates.dueDate),
                isCritical ? t.gantt.critical : float !== undefined ? t.gantt.float(float) : '',
                row.task.allowNonWorkingDays ? t.gantt.nonWorkingTask : '',
              ]
                .filter(Boolean)
                .join('\n');

              if (row.hasChildren) {
                return (
                  <div
                    key={row.task.id}
                    className={styles.summary}
                    style={{ left: box.x1, width: box.x2 - box.x1, top: top + (ROW_HEIGHT - SUMMARY_HEIGHT) / 2 - 2 }}
                    title={`${tooltip}\n${t.gantt.summaryLocked}`}
                    data-task-id={row.task.id}
                    onClick={() => props.onOpenTask(row.task.id)}
                  >
                    <span className={styles.summaryProgress} style={{ width: `${dates.progress}%` }} />
                    <span className={styles.summaryLabel}>{row.task.name}</span>
                  </div>
                );
              }

              if (row.task.isMilestone) {
                const cx = (box.x1 + box.x2) / 2;
                return (
                  <div
                    key={row.task.id}
                    className={clsx(styles.milestone, isCritical && styles.critical, isTarget && styles.target, dragging && styles.dragging)}
                    style={{ left: cx - 8, top: top + ROW_HEIGHT / 2 - 8 }}
                    title={tooltip}
                    data-task-id={row.task.id}
                    onPointerDown={(event) => beginDrag(event, row.task.id, 'move')}
                  >
                    <span className={styles.diamond} />
                    <span className={styles.milestoneLabel}>{row.task.name}</span>
                    <span className={styles.handle} onPointerDown={(event) => beginLink(event, row.task.id)} />
                  </div>
                );
              }

              const width = box.x2 - box.x1;
              const labelInside = width > row.task.name.length * 6.5 + 24;
              return (
                <div
                  key={row.task.id}
                  className={clsx(
                    styles.bar,
                    row.task.status === 'done' && styles.barDone,
                    isCritical && styles.critical,
                    isTarget && styles.target,
                    dragging && styles.dragging,
                  )}
                  style={{ left: box.x1 + 1, width: Math.max(6, width - 2), top: top + (ROW_HEIGHT - BAR_HEIGHT) / 2, ['--bar-color' as string]: color }}
                  title={tooltip}
                  data-task-id={row.task.id}
                  onPointerDown={(event) => beginDrag(event, row.task.id, 'move')}
                >
                  <span className={styles.barProgress} style={{ width: `${dates.progress}%` }} />
                  {labelInside && <span className={styles.barLabel}>{row.task.name}</span>}
                  <span className={clsx(styles.resize, styles.resizeStart)} onPointerDown={(event) => beginDrag(event, row.task.id, 'start')} />
                  <span className={clsx(styles.resize, styles.resizeEnd)} onPointerDown={(event) => beginDrag(event, row.task.id, 'end')} />
                  <span className={styles.handle} onPointerDown={(event) => beginLink(event, row.task.id)} />
                  {!labelInside && <span className={styles.outsideLabel}>{row.task.name}</span>}
                </div>
              );
            })}

            {drag && drag.kind !== 'link' && drag.moved && (() => {
              const task = preview.tasks.find((item) => item.id === drag.taskId);
              if (!task?.startDate || !task.dueDate) return null;
              const index = rows.findIndex((row) => row.task.id === task.id);
              const box = boxes.get(task.id);
              if (index < 0 || !box) return null;
              return (
                <div className={styles.dragTip} style={{ left: box.x1, top: index * ROW_HEIGHT - 22 }}>
                  {task.startDate === task.dueDate ? format.dayMonth(task.startDate) : format.range(task.startDate, task.dueDate)}
                  {' · '}
                  {t.gantt.durationDays(workdayDuration(task, calendar))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
