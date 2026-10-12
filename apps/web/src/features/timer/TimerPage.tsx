import { formatClock, fromIsoDate, toIsoDate, type TimeEntry } from '@ott/shared';
import { addDays, startOfDay, startOfWeek } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, List, Settings } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useProjectMap } from '../../api/projects';
import { useTasks } from '../../api/tasks';
import { useTimeEntries, useUpdateTimeEntry } from '../../api/timeEntries';
import { usePreferences } from '../../app/session';
import { IconButton } from '../../components/ui/Button';
import { Calendar } from '../../components/ui/Calendar';
import { LoadingBlock } from '../../components/ui/EmptyState';
import { Menu } from '../../components/ui/Menu';
import { Popover } from '../../components/ui/Popover';
import { ChipButton, Segmented, Toolbar, ToolbarSpacer } from '../../components/ui/Toolbar';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useStoredState } from '../../lib/hooks';
import { CalendarView } from './CalendarView';
import { EntryEditor, type EntryEditorState } from './EntryEditor';
import { ListView } from './ListView';
import { TimerBar } from './TimerBar';
import { TimesheetView } from './TimesheetView';
import styles from './TimerPage.module.css';

type View = 'calendar' | 'list' | 'timesheet';
type Span = 'week' | 'day';

export function TimerPage() {
  const t = useT();
  const format = useFormat();
  const { weekStart } = usePreferences();
  const [view, setView] = useStoredState<View>('ott.timerView', 'calendar');
  const [span, setSpan] = useStoredState<Span>('ott.timerSpan', 'week');
  const [showWeekends, setShowWeekends] = useStoredState('ott.showWeekends', true);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [editor, setEditor] = useState<EntryEditorState | null>(null);

  const weekBegin = startOfWeek(anchor, { weekStartsOn: weekStart });
  const rangeStart = view === 'calendar' && span === 'day' ? anchor : weekBegin;
  const rangeLength = view === 'calendar' && span === 'day' ? 1 : 7;
  const rangeEnd = addDays(rangeStart, rangeLength);
  const from = rangeStart.toISOString();
  const to = rangeEnd.toISOString();

  const { data: entries = [], isLoading } = useTimeEntries(from, to);
  const projects = useProjectMap();
  const { data: tasks = [] } = useTasks();
  const updateEntry = useUpdateTimeEntry();
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task.name])), [tasks]);

  const days = useMemo(() => {
    const list = Array.from({ length: rangeLength }, (_, index) => addDays(rangeStart, index));
    if (rangeLength === 7 && !showWeekends && view === 'calendar') {
      return list.filter((day) => day.getDay() !== 0 && day.getDay() !== 6);
    }
    return list;
  }, [rangeStart.getTime(), rangeLength, showWeekends, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) {
      const start = new Date(entry.start);
      const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
      map.set(key, (map.get(key) ?? 0) + entry.duration);
    }
    return map;
  }, [entries]);
  const weekTotal = entries.reduce((sum, entry) => sum + entry.duration, 0);

  const step = rangeLength === 1 ? 1 : 7;
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: weekStart });
  const weekNumber = format.week(toIsoDate(weekBegin));
  let rangeLabel: string;
  if (rangeLength === 1) {
    rangeLabel = toIsoDate(anchor) === toIsoDate(new Date()) ? t.common.today : format.dayLabel(anchor);
  } else if (weekBegin.getTime() === thisWeek.getTime()) {
    rangeLabel = t.timer.thisWeek;
  } else if (weekBegin.getTime() === addDays(thisWeek, -7).getTime()) {
    rangeLabel = t.timer.lastWeek;
  } else {
    rangeLabel = format.range(weekBegin, addDays(weekBegin, 6));
  }

  const changeTimes = (entry: TimeEntry, start: Date, end: Date) =>
    updateEntry.mutate({ id: entry.id, start: start.toISOString(), stop: end.toISOString() });

  return (
    <div className={styles.page}>
      <TimerBar recentEntries={entries} defaultDate={anchor} />
      <Toolbar>
        <IconButton icon={<ChevronLeft />} label={t.common.previous} variant="secondary" size="sm" onClick={() => setAnchor(addDays(anchor, -step))} />
        <Popover
          initialFocus={-1}
          trigger={({ ref, getProps }) => (
            <ChipButton
              ref={ref}
              icon={<CalendarDays />}
              label={rangeLabel}
              value={rangeLength === 7 ? `· ${t.timer.weekShort}${weekNumber}` : undefined}
              {...getProps()}
            />
          )}
        >
          {({ close }) => (
            <Calendar
              start={toIsoDate(anchor)}
              onSelect={(day) => {
                setAnchor(fromIsoDate(day));
                close();
              }}
            />
          )}
        </Popover>
        <IconButton icon={<ChevronRight />} label={t.common.next} variant="secondary" size="sm" onClick={() => setAnchor(addDays(anchor, step))} />
        <span className={styles.total}>
          {t.timer.weekTotal}: <strong className="tabular">{formatClock(weekTotal)}</strong>
        </span>
        <ToolbarSpacer />
        {view === 'calendar' && (
          <Segmented<Span>
            value={span}
            onChange={setSpan}
            options={[
              { value: 'day', label: t.timer.day },
              { value: 'week', label: t.timer.week },
            ]}
          />
        )}
        <Segmented<View>
          value={view}
          onChange={setView}
          options={[
            { value: 'calendar', label: t.timer.calendar, icon: <CalendarDays /> },
            { value: 'list', label: t.timer.list, icon: <List /> },
            { value: 'timesheet', label: t.timer.timesheet, icon: <LayoutGrid /> },
          ]}
        />
        <Menu
          placement="bottom-end"
          trigger={({ ref, getProps }) => <IconButton ref={ref} icon={<Settings />} label={t.timer.calendarSettings} {...getProps()} />}
          items={[
            { key: 'weekends', label: t.timer.showWeekends, checked: showWeekends, onSelect: () => setShowWeekends(!showWeekends) },
            { key: 'now', label: t.timer.goToNow, onSelect: () => setAnchor(startOfDay(new Date())) },
          ]}
        />
      </Toolbar>
      <div className={styles.content}>
        {isLoading ? (
          <LoadingBlock />
        ) : view === 'calendar' ? (
          <CalendarView
            days={days}
            entries={entries}
            projects={projects}
            totals={totals}
            onOpen={(entry) => setEditor({ mode: 'edit', entry })}
            onCreate={(start, end) => setEditor({ mode: 'new', start, end })}
            onChangeTimes={changeTimes}
          />
        ) : view === 'list' ? (
          <div className={styles.scroll}>
            <ListView entries={entries} projects={projects} tasksById={tasksById} onOpen={(entry) => setEditor({ mode: 'edit', entry })} />
          </div>
        ) : (
          <div className={styles.scroll}>
            <TimesheetView days={days} entries={entries.filter((entry) => entry.stop !== null)} projects={projects} tasksById={tasksById} />
          </div>
        )}
      </div>
      {editor && <EntryEditor key={editor.mode === 'edit' ? editor.entry.id : 'new'} state={editor} onClose={() => setEditor(null)} />}
    </div>
  );
}
