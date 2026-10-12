// Modal de apontamento: cria (arrastando no calendário) ou edita um apontamento.
import { formatClock, fromIsoDate, toIsoDate, type Id, type TimeEntry } from '@ott/shared';
import { CircleDollarSign, Copy, Folder, Hash, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useProjectMap } from '../../data/projects';
import { useTasks } from '../../data/tasks';
import { useCreateTimeEntry, useDeleteTimeEntry, useUpdateTimeEntry } from '../../data/timeEntries';
import { useTags } from '../../data/workspace';
import { ProjectTaskPicker } from '../../components/pickers/ProjectTaskPicker';
import pickerStyles from '../../components/pickers/Picker.module.css';
import { TagPicker } from '../../components/pickers/TagPicker';
import { DurationInput, TimeInput } from '../../components/pickers/TimeInputs';
import { Button } from '../../components/ui/Button';
import { Calendar } from '../../components/ui/Calendar';
import { Input, Switch } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Popover } from '../../components/ui/Popover';
import { ProjectLabel } from '../../components/ui/ProjectLabel';
import { toast } from '../../components/ui/Toast';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useNow } from '../../lib/hooks';
import styles from './EntryEditor.module.css';

export type EntryEditorState =
  | { mode: 'edit'; entry: TimeEntry }
  | { mode: 'new'; start: Date; end: Date; projectId?: Id | null; taskId?: Id | null };

export function EntryEditor({ state, onClose }: { state: EntryEditorState; onClose: () => void }) {
  const t = useT();
  const format = useFormat();
  const now = useNow(1000);
  const projects = useProjectMap();
  const { data: tasks = [] } = useTasks();
  const { data: tags = [] } = useTags();
  const create = useCreateTimeEntry();
  const update = useUpdateTimeEntry();
  const remove = useDeleteTimeEntry();

  const entry = state.mode === 'edit' ? state.entry : null;
  const running = entry !== null && entry.stop === null;
  const [description, setDescription] = useState(entry?.description ?? '');
  const [projectId, setProjectId] = useState<Id | null>(entry?.projectId ?? (state.mode === 'new' ? (state.projectId ?? null) : null));
  const [taskId, setTaskId] = useState<Id | null>(entry?.taskId ?? (state.mode === 'new' ? (state.taskId ?? null) : null));
  const [tagIds, setTagIds] = useState<Id[]>(entry?.tagIds ?? []);
  const [billable, setBillable] = useState<boolean | null>(entry?.billable ?? null);
  const [start, setStart] = useState(() => (entry ? new Date(entry.start) : (state as { start: Date }).start));
  const [end, setEnd] = useState(() =>
    entry ? (entry.stop ? new Date(entry.stop) : new Date()) : (state as { end: Date }).end,
  );

  const project = projectId ? projects.get(projectId) : undefined;
  const task = taskId ? tasks.find((item) => item.id === taskId) : undefined;
  const effectiveBillable = billable ?? project?.billable ?? false;
  const effectiveEnd = running ? now : end;
  const seconds = Math.max(0, (effectiveEnd.getTime() - start.getTime()) / 1000);
  const tagNames = tags.filter((tag) => tagIds.includes(tag.id)).map((tag) => tag.name);

  const changeDay = (iso: string) => {
    const base = fromIsoDate(iso);
    const nextStart = new Date(base);
    nextStart.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
    const length = end.getTime() - start.getTime();
    setStart(nextStart);
    setEnd(new Date(nextStart.getTime() + length));
  };

  const changeEnd = (value: Date) => {
    // Fim antes do início significa que passou da meia-noite.
    setEnd(value <= start ? new Date(value.getTime() + 86_400_000) : value);
  };

  const save = () => {
    const common = {
      description: description.trim(),
      projectId,
      taskId,
      tagIds,
      ...(billable === null ? {} : { billable }),
    };
    if (entry) {
      update.mutate(
        { id: entry.id, ...common, start: start.toISOString(), ...(running ? {} : { stop: end.toISOString() }) },
        { onSuccess: onClose },
      );
    } else {
      create.mutate({ ...common, start: start.toISOString(), stop: end.toISOString() }, { onSuccess: onClose });
    }
  };

  const duplicate = () => {
    if (!entry || running) return;
    create.mutate(
      {
        description: entry.description,
        projectId: entry.projectId,
        taskId: entry.taskId,
        tagIds: entry.tagIds,
        billable: entry.billable,
        start: entry.start,
        stop: entry.stop!,
      },
      {
        onSuccess: () => {
          toast.success(t.timer.entryDuplicated);
          onClose();
        },
      },
    );
  };

  const destroy = () => {
    if (!entry) return;
    remove.mutate(entry.id, {
      onSuccess: () => {
        toast.success(t.timer.entryDeleted);
        onClose();
      },
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={entry ? t.timer.editEntry : t.timer.newEntry}
      width={520}
      footer={
        <div className={styles.footer}>
          {entry && (
            <div className={styles.footerLeft}>
              <Button variant="ghost" icon={<Trash2 />} onClick={destroy}>
                {t.common.delete}
              </Button>
              {!running && (
                <Button variant="ghost" icon={<Copy />} onClick={duplicate}>
                  {t.common.duplicate}
                </Button>
              )}
            </div>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" onClick={save} loading={create.isPending || update.isPending}>
            {entry ? t.common.save : t.common.create}
          </Button>
        </div>
      }
    >
      <Input
        className={styles.description}
        value={description}
        placeholder={t.timer.addDescription}
        onChange={(event) => setDescription(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && save()}
        autoFocus
      />
      <div className={styles.links}>
        <ProjectTaskPicker
          value={{ projectId, taskId }}
          onChange={(value) => {
            setProjectId(value.projectId);
            setTaskId(value.taskId);
          }}
          trigger={({ ref, getProps }) => (
            <button ref={ref} type="button" className={`${pickerStyles.trigger} ${project ? '' : pickerStyles.dashed}`} {...getProps()}>
              {project ? (
                <ProjectLabel name={project.name} color={project.color} taskName={task?.name} />
              ) : (
                <>
                  <Folder size={14} /> {t.timer.projectOrTask}
                </>
              )}
            </button>
          )}
        />
        <TagPicker
          value={tagIds}
          onChange={setTagIds}
          trigger={({ ref, getProps }) => (
            <button ref={ref} type="button" className={`${pickerStyles.trigger} ${tagNames.length ? '' : pickerStyles.dashed}`} {...getProps()}>
              <Hash size={14} /> {tagNames.length ? tagNames.join(', ') : t.timer.tags}
            </button>
          )}
        />
        <label className={styles.billable}>
          <CircleDollarSign size={16} />
          <span>{t.timer.billable}</span>
          <Switch checked={effectiveBillable} onChange={setBillable} label={t.timer.billable} />
        </label>
      </div>

      <div className={styles.times}>
        <div className={styles.timeField}>
          <span className={styles.label}>{t.timer.startTime}</span>
          <TimeInput value={start} display={format.time(start)} onCommit={setStart} aria-label={t.timer.startTime} />
        </div>
        <div className={styles.timeField}>
          <span className={styles.label}>{t.timer.endTime}</span>
          {running ? (
            <span className={styles.runningEnd}>{t.timer.runningSince(format.time(start))}</span>
          ) : (
            <TimeInput value={end} display={format.time(end)} onCommit={changeEnd} aria-label={t.timer.endTime} />
          )}
        </div>
        <div className={styles.timeField}>
          <span className={styles.label}>{t.timer.date}</span>
          <Popover
            initialFocus={-1}
            trigger={({ ref, getProps }) => (
              <button ref={ref} type="button" className={styles.dateButton} {...getProps()}>
                {format.dayLabel(start)}
              </button>
            )}
          >
            {({ close }) => (
              <Calendar
                start={toIsoDate(start)}
                onSelect={(day) => {
                  changeDay(day);
                  close();
                }}
              />
            )}
          </Popover>
        </div>
        <div className={styles.timeField}>
          <span className={styles.label}>{t.timer.duration}</span>
          {running ? (
            <span className={styles.runningEnd}>{formatClock(seconds)}</span>
          ) : (
            <DurationInput
              seconds={seconds}
              display={formatClock(seconds)}
              onCommit={(value) => value && setEnd(new Date(start.getTime() + value * 1000))}
              aria-label={t.timer.duration}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
