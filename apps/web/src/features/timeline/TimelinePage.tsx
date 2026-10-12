// Linha do tempo (Toggl "Timeline"): planejamento de capacidade por pessoa ou por
// projeto. Cada faixa mostra as tarefas agendadas e a carga diária; a coluna da
// esquerda mostra horas livres (ou acima) no período de capacidade escolhido.
import {
  addDays,
  capacityInRange,
  computeAllocations,
  dailyCapacitySeconds,
  diffDays,
  eachDay,
  startOfWeekIso,
  toIsoDate,
  UNASSIGNED,
  weekday,
  type Id,
  type IsoDate,
  type Task,
} from '@ott/shared';
import clsx from 'clsx';
import { CalendarRange, ChevronLeft, ChevronRight, Crosshair, ListTree, Minus, Plus, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectMap } from '../../api/projects';
import { useScheduleTasks, useTasks } from '../../api/tasks';
import { useMembers } from '../../api/workspace';
import { useIsAdmin, usePreferences, useWorkspace } from '../../app/session';
import { Avatar } from '../../components/ui/Avatar';
import { Button, IconButton } from '../../components/ui/Button';
import { EmptyState, LoadingBlock } from '../../components/ui/EmptyState';
import { Menu } from '../../components/ui/Menu';
import { ColorDot } from '../../components/ui/ProjectLabel';
import { ChipButton, Toolbar, ToolbarSpacer } from '../../components/ui/Toolbar';
import { useT } from '../../i18n';
import { PageHeader } from '../../layout/PageHeader';
import { useFormat } from '../../lib/format';
import { useStoredState } from '../../lib/hooks';
import { useTaskPanel } from '../tasks/TaskPanelContext';
import { packLanes } from './timelineModel';
import styles from './TimelinePage.module.css';

type GroupBy = 'people' | 'projects';
type CapacityPeriod = 'thisWeek' | 'nextWeek' | 'thisMonth';

const ZOOM_LEVELS = [36, 56, 84];
const BAR_HEIGHT = 24;
const LANE_GAP = 4;
const LOAD_STRIP = 18;
const WEEKS_VISIBLE = 6;

interface Lane {
  key: string;
  label: string;
  avatar?: { name: string; color: string };
  color?: string;
  tasks: Task[];
  userId?: Id;
  weeklyCapacity?: number;
}

type Drag = { taskId: Id; kind: 'move' | 'end'; originX: number; delta: number; moved: boolean };

export function TimelinePage() {
  const t = useT();
  const format = useFormat();
  const navigate = useNavigate();
  const panel = useTaskPanel();
  const isAdmin = useIsAdmin();
  const workspace = useWorkspace();
  const { weekStart } = usePreferences();
  const projects = useProjectMap();
  const { data: tasks = [], isLoading } = useTasks();
  const { data: members = [] } = useMembers();
  const schedule = useScheduleTasks();
  const [groupBy, setGroupBy] = useStoredState<GroupBy>('ott.timelineGroup', 'people');
  const [period, setPeriod] = useStoredState<CapacityPeriod>('ott.timelinePeriod', 'thisWeek');
  const [zoomIndex, setZoomIndex] = useStoredState('ott.timelineZoom', 2);
  const today = toIsoDate(new Date());
  const [anchor, setAnchor] = useState(() => addDays(startOfWeekIso(today, weekStart), -2));
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  const scrollRef = useRef<HTMLDivElement>(null);

  const dayWidth = ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, zoomIndex))]!;
  const rangeStart = anchor;
  const rangeEnd = addDays(anchor, WEEKS_VISIBLE * 7 - 1);
  const days = useMemo(() => eachDay(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  const timelineWidth = days.length * dayWidth;

  // Tarefas folha, abertas e com datas: é o que ocupa capacidade.
  const parentIds = useMemo(() => new Set(tasks.map((task) => task.parentId)), [tasks]);
  const planned = useMemo(
    () => tasks.filter((task) => task.status !== 'done' && !parentIds.has(task.id) && (task.startDate || task.dueDate)),
    [tasks, parentIds],
  );

  // Prévia do arraste aplicada só na tarefa arrastada.
  const shown = useMemo(() => {
    if (!drag || !drag.moved || drag.delta === 0) return planned;
    return planned.map((task) => {
      if (task.id !== drag.taskId) return task;
      const start = task.startDate ?? task.dueDate!;
      const due = task.dueDate ?? task.startDate!;
      if (drag.kind === 'move') return { ...task, startDate: addDays(start, drag.delta), dueDate: addDays(due, drag.delta) };
      const nextDue = addDays(due, drag.delta);
      return { ...task, startDate: start, dueDate: nextDue < start ? start : nextDue };
    });
  }, [planned, drag]);

  const capacityRange = useMemo(() => {
    if (period === 'thisMonth') {
      const first = `${today.slice(0, 7)}-01`;
      const next = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1));
      return { start: first, end: addDays(next.toISOString().slice(0, 10), -1) };
    }
    const start = addDays(startOfWeekIso(today, weekStart), period === 'nextWeek' ? 7 : 0);
    return { start, end: addDays(start, 6) };
  }, [period, today, weekStart]);

  const visibleAllocation = useMemo(
    () => computeAllocations(shown, { start: rangeStart, end: rangeEnd }, workspace.workingDays),
    [shown, rangeStart, rangeEnd, workspace.workingDays],
  );
  const periodAllocation = useMemo(
    () => computeAllocations(shown, capacityRange, workspace.workingDays),
    [shown, capacityRange, workspace.workingDays],
  );

  const lanes: Lane[] = useMemo(() => {
    if (groupBy === 'projects') {
      const byProject = new Map<number, Task[]>();
      for (const task of shown) {
        const key = task.projectId ?? 0;
        byProject.set(key, [...(byProject.get(key) ?? []), task]);
      }
      return [...byProject.entries()]
        .map(([projectId, list]) => {
          const project = projects.get(projectId);
          return { key: `p${projectId}`, label: project?.name ?? t.tasks.noProject, color: project?.color, tasks: list };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    const result: Lane[] = [
      { key: 'none', label: t.timeline.noAssignee, tasks: shown.filter((task) => task.assigneeIds.length === 0) },
    ];
    for (const member of members.filter((m) => m.active)) {
      result.push({
        key: `u${member.userId}`,
        label: member.name,
        avatar: { name: member.name, color: member.avatarColor },
        tasks: shown.filter((task) => task.assigneeIds.includes(member.userId)),
        userId: member.userId,
        weeklyCapacity: member.weeklyCapacityHours,
      });
    }
    return result;
  }, [groupBy, shown, members, projects, t]);

  const xOf = (date: IsoDate) => diffDays(rangeStart, date) * dayWidth;

  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      const dx = event.clientX - current.originX;
      setDrag({ ...current, delta: Math.round(dx / dayWidth), moved: current.moved || Math.abs(dx) > 3 });
    };
    const onUp = () => {
      const current = dragRef.current;
      setDrag(null);
      if (!current) return;
      if (!current.moved) {
        panel.openTask(current.taskId);
        return;
      }
      const task = shown.find((item) => item.id === current.taskId);
      if (task && current.delta !== 0) {
        schedule.mutate({ updates: [{ id: task.id, startDate: task.startDate, dueDate: task.dueDate }] });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null, shown]);

  const startDrag = (event: ReactPointerEvent, taskId: Id, kind: Drag['kind']) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    setDrag({ taskId, kind, originX: event.clientX, delta: 0, moved: false });
  };

  const periodLabels: Record<CapacityPeriod, string> = {
    thisWeek: t.timeline.thisWeek,
    nextWeek: t.timeline.nextWeek,
    thisMonth: t.timeline.thisMonth,
  };
  const weeks = days.filter((day, index) => index === 0 || weekday(day) === weekStart);
  const months = days.filter((day, index) => index === 0 || day.endsWith('-01'));
  const todayX = today >= rangeStart && today <= rangeEnd ? xOf(today) : null;

  if (isLoading) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title={t.timeline.title}
        actions={
          isAdmin && (
            <Button variant="primary" icon={<UserPlus />} onClick={() => navigate('/members?add=1')}>
              {t.timeline.addMember}
            </Button>
          )
        }
      />
      <Toolbar>
        <Menu
          trigger={({ ref, getProps }) => (
            <ChipButton ref={ref} icon={<ListTree />} label={`${t.common.groupBy}:`} value={groupBy === 'people' ? t.timeline.groupPeople : t.timeline.groupProjects} {...getProps()} />
          )}
          items={[
            { key: 'people', label: t.timeline.groupPeople, checked: groupBy === 'people', onSelect: () => setGroupBy('people') },
            { key: 'projects', label: t.timeline.groupProjects, checked: groupBy === 'projects', onSelect: () => setGroupBy('projects') },
          ]}
        />
        {groupBy === 'people' && (
          <Menu
            trigger={({ ref, getProps }) => (
              <ChipButton ref={ref} icon={<CalendarRange />} label={`${t.timeline.capacity}:`} value={periodLabels[period]} {...getProps()} />
            )}
            items={(Object.keys(periodLabels) as CapacityPeriod[]).map((key) => ({
              key,
              label: periodLabels[key],
              checked: key === period,
              onSelect: () => setPeriod(key),
            }))}
          />
        )}
        <ToolbarSpacer />
        <IconButton icon={<ChevronLeft />} label={t.common.previous} variant="secondary" size="sm" onClick={() => setAnchor(addDays(anchor, -7))} />
        <IconButton icon={<ChevronRight />} label={t.common.next} variant="secondary" size="sm" onClick={() => setAnchor(addDays(anchor, 7))} />
        <Button size="sm" icon={<Crosshair />} onClick={() => setAnchor(addDays(startOfWeekIso(today, weekStart), -2))}>
          {t.common.today}
        </Button>
        <div className={styles.zoom}>
          <IconButton icon={<Minus />} label={t.timeline.zoomOut} size="sm" disabled={zoomIndex <= 0} onClick={() => setZoomIndex(zoomIndex - 1)} />
          <IconButton icon={<Plus />} label={t.timeline.zoomIn} size="sm" disabled={zoomIndex >= ZOOM_LEVELS.length - 1} onClick={() => setZoomIndex(zoomIndex + 1)} />
        </div>
      </Toolbar>

      <div className={styles.scroller} ref={scrollRef}>
        <div className={styles.inner} style={{ width: 240 + timelineWidth }}>
          <div className={styles.head}>
            <div className={styles.corner}>
              {groupBy === 'people' ? t.timeline.people : t.timeline.groupProjects} <span className={styles.count}>{lanes.length - (groupBy === 'people' ? 1 : 0)}</span>
            </div>
            <div className={styles.scale} style={{ width: timelineWidth }}>
              <div className={styles.monthRow}>
                {months.map((day) => (
                  <span key={day} style={{ left: xOf(day) }}>
                    {format.monthLong(day)}
                  </span>
                ))}
              </div>
              <div className={styles.weekRow}>
                {weeks.map((day) => (
                  <span key={day} style={{ left: xOf(day) }}>
                    {t.timer.weekShort}
                    {format.week(day)}
                  </span>
                ))}
              </div>
              <div className={styles.dayRow}>
                {days.map((day) => (
                  <span
                    key={day}
                    className={clsx(day === today && styles.today, !workspace.workingDays.includes(weekday(day)) && styles.weekendHead)}
                    style={{ left: xOf(day), width: dayWidth }}
                  >
                    {dayWidth >= 56 ? `${format.weekdayShort(day)} ${Number(day.slice(8))}` : Number(day.slice(8))}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {lanes.map((lane) => {
            const packed = packLanes(
              lane.tasks.map((task) => ({ id: task.id, start: task.startDate ?? task.dueDate!, end: task.dueDate ?? task.startDate! })),
            );
            const height = Math.max(64, packed.count * (BAR_HEIGHT + LANE_GAP) + LANE_GAP + LOAD_STRIP + 6);
            const userKey = lane.userId ?? (lane.key === 'none' ? UNASSIGNED : null);
            const dailyLoad = userKey !== null ? visibleAllocation.byUser.get(userKey) : undefined;
            const capacity = lane.weeklyCapacity !== undefined ? capacityInRange(lane.weeklyCapacity, capacityRange, workspace.workingDays) : null;
            const allocated = userKey !== null ? [...(periodAllocation.byUser.get(userKey)?.values() ?? [])].reduce((a, b) => a + b, 0) : 0;
            const free = capacity !== null ? capacity - allocated : null;
            const perDayCapacity = lane.weeklyCapacity !== undefined ? dailyCapacitySeconds(lane.weeklyCapacity, workspace.workingDays) : null;
            return (
              <div key={lane.key} className={styles.lane} style={{ height }}>
                <div className={styles.laneHead}>
                  {free !== null && capacity !== null && (
                    <div className={styles.capacity} title={t.timeline.allocated(format.hours(allocated), format.hours(capacity))}>
                      <span className={styles.capacityBar}>
                        <span
                          className={clsx(free < 0 && styles.capacityOver)}
                          style={{ width: `${Math.min(100, capacity ? (allocated / capacity) * 100 : 0)}%` }}
                        />
                      </span>
                      <span className={clsx(styles.capacityText, free < 0 && styles.overText)}>
                        {free >= 0 ? t.timeline.free(format.hours(free)) : t.timeline.over(format.hours(-free))}
                      </span>
                    </div>
                  )}
                  <div className={styles.laneName}>
                    {lane.avatar ? (
                      <Avatar name={lane.avatar.name} color={lane.avatar.color} size={24} />
                    ) : lane.color ? (
                      <ColorDot color={lane.color} size={10} />
                    ) : (
                      <span className={styles.na}>NA</span>
                    )}
                    <span>{lane.label}</span>
                  </div>
                </div>
                <div className={styles.laneBody} style={{ width: timelineWidth }}>
                  {days.map((day) =>
                    workspace.workingDays.includes(weekday(day)) ? null : (
                      <div key={day} className={styles.weekend} style={{ left: xOf(day), width: dayWidth }} />
                    ),
                  )}
                  {todayX !== null && <div className={styles.todayLine} style={{ left: todayX + dayWidth / 2 }} />}
                  {lane.tasks.map((task) => {
                    const start = task.startDate ?? task.dueDate!;
                    const end = task.dueDate ?? task.startDate!;
                    if (end < rangeStart || start > rangeEnd) return null;
                    const project = task.projectId ? projects.get(task.projectId) : undefined;
                    const laneIndex = packed.lanes.get(task.id) ?? 0;
                    const left = xOf(start);
                    const width = (diffDays(start, end) + 1) * dayWidth;
                    const perUser = userKey !== null ? visibleAllocation.byTask.get(task.id)?.get(userKey) : undefined;
                    return (
                      <div
                        key={task.id}
                        className={clsx(styles.bar, drag?.taskId === task.id && drag.moved && styles.dragging)}
                        style={{
                          left: left + 2,
                          width: Math.max(8, width - 4),
                          top: LANE_GAP + laneIndex * (BAR_HEIGHT + LANE_GAP),
                          ['--bar-color' as string]: project?.color ?? 'var(--accent)',
                        }}
                        title={`${task.name}${project ? ` · ${project.name}` : ''}${perUser ? ` · ${format.hours(perUser)}` : ''}`}
                        onPointerDown={(event) => startDrag(event, task.id, 'move')}
                      >
                        <span className={styles.barLabel}>{task.name}</span>
                        {task.estimateSeconds ? <span className={styles.barHours}>{format.hours(task.estimateSeconds)}</span> : null}
                        <span className={styles.barResize} onPointerDown={(event) => startDrag(event, task.id, 'end')} />
                      </div>
                    );
                  })}
                  {dailyLoad && (
                    <div className={styles.loadStrip}>
                      {days.map((day) => {
                        const seconds = dailyLoad.get(day) ?? 0;
                        if (!seconds) return null;
                        const over = perDayCapacity !== null && seconds > perDayCapacity + 60;
                        return (
                          <span
                            key={day}
                            className={clsx(styles.load, over && styles.loadOver)}
                            style={{ left: xOf(day), width: dayWidth }}
                            title={t.timeline.dayLoad(format.hours(seconds))}
                          >
                            {dayWidth >= 36 ? format.hours(seconds) : ''}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {groupBy === 'people' && members.length <= 1 && (
            <EmptyState
              illustration="people"
              title={t.timeline.emptyTitle}
              text={t.timeline.emptyText}
              action={
                isAdmin && (
                  <Button variant="primary" onClick={() => navigate('/members?add=1')}>
                    {t.timeline.invite}
                  </Button>
                )
              }
            />
          )}
          {groupBy === 'projects' && lanes.length === 0 && <EmptyState compact illustration="chart" title={t.timeline.noTasks} />}
        </div>
      </div>
    </>
  );
}
