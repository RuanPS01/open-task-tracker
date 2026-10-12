// Barra do cronômetro no topo da tela Cronômetro, como no Toggl Track:
// descrição, projeto ou tarefa, tags, faturável, relógio e botão iniciar/parar.
// Com o cronômetro rodando, editar qualquer campo altera o apontamento em andamento.
import { formatClock, fromIsoDate, toIsoDate, type Id, type TimeEntry } from '@ott/shared';
import clsx from 'clsx';
import { CircleDollarSign, Clock, Folder, Hash, ListPlus, Play, Plus, Square } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useProjectMap } from '../../data/projects';
import { useTasks } from '../../data/tasks';
import {
  useCreateTimeEntry,
  useRunningTimer,
  useStartTimer,
  useStopTimer,
  useUpdateTimeEntry,
} from '../../data/timeEntries';
import { useTags } from '../../data/workspace';
import { ProjectTaskPicker } from '../../components/pickers/ProjectTaskPicker';
import { TagPicker } from '../../components/pickers/TagPicker';
import { DurationInput, TimeInput } from '../../components/pickers/TimeInputs';
import { Calendar } from '../../components/ui/Calendar';
import { ProjectLabel } from '../../components/ui/ProjectLabel';
import { Popover } from '../../components/ui/Popover';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useNow, useStoredState } from '../../lib/hooks';
import styles from './TimerBar.module.css';

interface Draft {
  description: string;
  projectId: Id | null;
  taskId: Id | null;
  tagIds: Id[];
  billable: boolean | null;
}

const EMPTY: Draft = { description: '', projectId: null, taskId: null, tagIds: [], billable: null };

/** Sugestões de descrição a partir dos apontamentos recentes e das tarefas abertas. */
function useSuggestions(query: string, recent: TimeEntry[]) {
  const { data: tasks = [] } = useTasks();
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const seen = new Set<string>();
    const fromEntries = recent
      .filter((entry) => entry.description.toLowerCase().includes(q))
      .filter((entry) => {
        const key = `${entry.description}|${entry.projectId}|${entry.taskId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5)
      .map((entry) => ({
        key: `e${entry.id}`,
        description: entry.description,
        projectId: entry.projectId,
        taskId: entry.taskId,
        tagIds: entry.tagIds,
      }));
    const fromTasks = tasks
      .filter((task) => task.status !== 'done' && task.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((task) => ({ key: `t${task.id}`, description: task.name, projectId: task.projectId, taskId: task.id, tagIds: task.tagIds }));
    return [...fromEntries, ...fromTasks];
  }, [query, recent, tasks]);
}

export function TimerBar({ recentEntries, defaultDate }: { recentEntries: TimeEntry[]; defaultDate: Date }) {
  const t = useT();
  const format = useFormat();
  const now = useNow(1000);
  const { data: running } = useRunningTimer();
  const start = useStartTimer();
  const stop = useStopTimer();
  const updateEntry = useUpdateTimeEntry();
  const createEntry = useCreateTimeEntry();
  const projects = useProjectMap();
  const { data: tasks = [] } = useTasks();
  const { data: tags = [] } = useTags();
  const [mode, setMode] = useStoredState<'timer' | 'manual'>('ott.timerMode', 'timer');
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [descriptionText, setDescriptionText] = useState('');
  const [focused, setFocused] = useState(false);

  // Modo manual: intervalo padrão de 1 hora terminando agora.
  const [manualStart, setManualStart] = useState(() => new Date(Date.now() - 3600_000));
  const [manualEnd, setManualEnd] = useState(() => new Date());

  useEffect(() => {
    setDescriptionText(running ? running.description : draft.description);
  }, [running, draft.description]);

  const current: Draft = running
    ? {
        description: running.description,
        projectId: running.projectId,
        taskId: running.taskId,
        tagIds: running.tagIds,
        billable: running.billable,
      }
    : draft;

  const apply = (change: Partial<Draft>) => {
    if (running) {
      const payload: Parameters<typeof updateEntry.mutate>[0] = { id: running.id };
      if (change.description !== undefined) payload.description = change.description;
      if (change.projectId !== undefined) payload.projectId = change.projectId;
      if (change.taskId !== undefined) payload.taskId = change.taskId;
      if (change.tagIds !== undefined) payload.tagIds = change.tagIds;
      if (change.billable !== undefined && change.billable !== null) payload.billable = change.billable;
      updateEntry.mutate(payload);
    } else {
      setDraft((value) => ({ ...value, ...change }));
    }
  };

  const suggestions = useSuggestions(running ? '' : descriptionText, recentEntries);
  const project = current.projectId ? projects.get(current.projectId) : undefined;
  const task = current.taskId ? tasks.find((item) => item.id === current.taskId) : undefined;
  const billable = current.billable ?? project?.billable ?? false;
  const elapsed = running ? (now.getTime() - Date.parse(running.start)) / 1000 : 0;
  const tagNames = tags.filter((tag) => current.tagIds.includes(tag.id)).map((tag) => tag.name);

  const startTimer = () => {
    start.mutate(
      {
        description: descriptionText.trim(),
        projectId: draft.projectId,
        taskId: draft.taskId,
        tagIds: draft.tagIds,
        ...(draft.billable === null ? {} : { billable: draft.billable }),
      },
      {
        onSuccess: () => {
          setDraft(EMPTY);
          setDescriptionText('');
        },
      },
    );
  };

  const addManual = () => {
    let endAt = manualEnd;
    if (endAt <= manualStart) endAt = new Date(endAt.getTime() + 86_400_000);
    createEntry.mutate(
      {
        description: descriptionText.trim(),
        projectId: draft.projectId,
        taskId: draft.taskId,
        tagIds: draft.tagIds,
        ...(draft.billable === null ? {} : { billable: draft.billable }),
        start: manualStart.toISOString(),
        stop: endAt.toISOString(),
      },
      {
        onSuccess: () => {
          setDraft(EMPTY);
          setDescriptionText('');
        },
      },
    );
  };

  const setManualDuration = (seconds: number | null) => {
    if (!seconds) return;
    setManualEnd(new Date(manualStart.getTime() + seconds * 1000));
  };

  // Mantém o dia do modo manual alinhado ao dia escolhido no calendário.
  useEffect(() => {
    setManualStart((value) => {
      const next = new Date(defaultDate);
      next.setHours(value.getHours(), value.getMinutes(), 0, 0);
      return next;
    });
    setManualEnd((value) => {
      const next = new Date(defaultDate);
      next.setHours(value.getHours(), value.getMinutes(), 0, 0);
      return next;
    });
  }, [defaultDate]);

  const manualSeconds = Math.max(0, (manualEnd.getTime() - manualStart.getTime()) / 1000);

  return (
    <div className={styles.bar}>
      <div className={styles.descriptionWrap}>
        <input
          className={styles.description}
          placeholder={t.timer.placeholder}
          value={descriptionText}
          onChange={(event) => setDescriptionText(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setFocused(false), 150);
            if (running && descriptionText !== running.description) apply({ description: descriptionText });
            if (!running) setDraft((value) => ({ ...value, description: descriptionText }));
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            if (running) {
              (event.target as HTMLInputElement).blur();
            } else if (mode === 'timer') {
              startTimer();
            } else {
              addManual();
            }
          }}
          aria-label={t.timer.placeholder}
        />
        {focused && suggestions.length > 0 && (
          <div className={styles.suggestions} role="listbox">
            {suggestions.map((suggestion) => {
              const suggestionProject = suggestion.projectId ? projects.get(suggestion.projectId) : undefined;
              return (
                <button
                  key={suggestion.key}
                  type="button"
                  className={styles.suggestion}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setDescriptionText(suggestion.description);
                    setDraft({
                      description: suggestion.description,
                      projectId: suggestion.projectId,
                      taskId: suggestion.taskId,
                      tagIds: suggestion.tagIds,
                      billable: null,
                    });
                    setFocused(false);
                  }}
                >
                  <span className={styles.suggestionText}>{suggestion.description}</span>
                  {suggestionProject && <ProjectLabel name={suggestionProject.name} color={suggestionProject.color} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ProjectTaskPicker
        placement="bottom-end"
        value={{ projectId: current.projectId, taskId: current.taskId }}
        onChange={(value) => apply(value)}
        trigger={({ ref, getProps }) =>
          project ? (
            <button ref={ref} type="button" className={styles.projectChip} {...getProps()}>
              <ProjectLabel name={project.name} color={project.color} taskName={task?.name} />
            </button>
          ) : (
            <button ref={ref} type="button" className={styles.pill} {...getProps()}>
              <Folder size={14} />
              <span>{t.timer.projectOrTask}</span>
            </button>
          )
        }
      />

      <TagPicker
        value={current.tagIds}
        onChange={(tagIds) => apply({ tagIds })}
        trigger={({ ref, getProps }) => (
          <button
            ref={ref}
            type="button"
            className={clsx(styles.pill, tagNames.length > 0 && styles.pillActive)}
            title={tagNames.join(', ') || t.timer.tags}
            {...getProps()}
          >
            <Hash size={14} />
            <span>{tagNames.length > 0 ? tagNames.join(', ') : t.timer.tags}</span>
          </button>
        )}
      />

      <button
        type="button"
        className={clsx(styles.iconToggle, billable && styles.iconToggleOn)}
        onClick={() => apply({ billable: !billable })}
        aria-pressed={billable}
        aria-label={t.timer.billable}
        title={t.timer.billable}
      >
        <CircleDollarSign size={18} />
      </button>

      {mode === 'timer' || running ? (
        <span className={styles.clock}>{formatClock(elapsed)}</span>
      ) : (
        <div className={styles.manual}>
          <TimeInput
            className={styles.timeInput}
            value={manualStart}
            display={format.time(manualStart)}
            onCommit={setManualStart}
            aria-label={t.timer.startTime}
          />
          <span className={styles.manualDash}>-</span>
          <TimeInput
            className={styles.timeInput}
            value={manualEnd}
            display={format.time(manualEnd)}
            onCommit={setManualEnd}
            aria-label={t.timer.endTime}
          />
          <Popover
            initialFocus={-1}
            trigger={({ ref, getProps }) => (
              <button ref={ref} type="button" className={styles.manualDate} {...getProps()}>
                {format.dayMonth(manualStart)}
              </button>
            )}
          >
            {({ close }) => (
              <Calendar
                start={toIsoDate(manualStart)}
                onSelect={(day) => {
                  const base = fromIsoDate(day);
                  const nextStart = new Date(base);
                  nextStart.setHours(manualStart.getHours(), manualStart.getMinutes(), 0, 0);
                  setManualStart(nextStart);
                  setManualEnd(new Date(nextStart.getTime() + manualSeconds * 1000));
                  close();
                }}
              />
            )}
          </Popover>
          <DurationInput
            className={styles.durationInput}
            seconds={manualSeconds}
            display={formatClock(manualSeconds)}
            onCommit={setManualDuration}
            aria-label={t.timer.duration}
          />
        </div>
      )}

      {running ? (
        <button type="button" className={clsx(styles.play, styles.stop)} onClick={() => stop.mutate(running)} aria-label={t.timer.stop} title={t.timer.stop}>
          <Square size={16} fill="currentColor" />
        </button>
      ) : mode === 'timer' ? (
        <button type="button" className={styles.play} onClick={startTimer} aria-label={t.timer.start} title={t.timer.start} disabled={start.isPending}>
          <Play size={18} fill="currentColor" />
        </button>
      ) : (
        <button type="button" className={styles.addButton} onClick={addManual} disabled={createEntry.isPending}>
          <Plus size={16} />
          {t.timer.add}
        </button>
      )}

      <div className={styles.modeSwitch}>
        <button
          type="button"
          className={clsx(styles.modeButton, mode === 'timer' && styles.modeActive)}
          onClick={() => setMode('timer')}
          aria-label={t.timer.timerMode}
          title={t.timer.timerMode}
        >
          <Clock size={14} />
        </button>
        <button
          type="button"
          className={clsx(styles.modeButton, mode === 'manual' && styles.modeActive)}
          onClick={() => setMode('manual')}
          aria-label={t.timer.manualMode}
          title={t.timer.manualMode}
          disabled={Boolean(running)}
        >
          <ListPlus size={14} />
        </button>
      </div>
    </div>
  );
}
