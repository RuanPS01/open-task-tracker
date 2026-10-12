// Painel lateral de tarefa. Tarefa nova trabalha num rascunho e só grava ao clicar em
// "Criar tarefa"; tarefa existente grava cada alteração na hora (como no Toggl).
import type { Task } from '@ott/shared';
import { ChevronDown, ChevronRight, Copy, MoreHorizontal, NotebookPen, Play, Square, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from '../../api/tasks';
import { useRunningTimer, useStartTimer, useStopTimer } from '../../api/timeEntries';
import { useCurrentUser } from '../../app/session';
import { StatusIcon } from '../../components/pickers/TaskIcons';
import { Button, IconButton } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/Confirm';
import { LoadingBlock } from '../../components/ui/EmptyState';
import { Menu } from '../../components/ui/Menu';
import { SidePanel } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { AllocationSection } from './AllocationSection';
import { DependencySection } from './DependencySection';
import { SubtaskSection } from './SubtaskSection';
import { TaskFields, type TaskDraft } from './TaskFields';
import { useTaskPanel, type TaskPanelState } from './TaskPanelContext';
import styles from './TaskPanel.module.css';

function draftFrom(task: Task): TaskDraft {
  return {
    name: task.name,
    description: task.description,
    notes: task.notes,
    projectId: task.projectId,
    parentId: task.parentId,
    startDate: task.startDate,
    dueDate: task.dueDate,
    estimateSeconds: task.estimateSeconds,
    estimateMode: task.estimateMode,
    priority: task.priority,
    tagIds: task.tagIds,
    assigneeIds: task.assigneeIds,
    status: task.status,
    billable: task.billable,
    isMilestone: task.isMilestone,
    allowNonWorkingDays: task.allowNonWorkingDays,
    progress: task.progress,
  };
}

/** Textarea que cresce com o conteúdo. */
function AutoTextArea({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
    />
  );
}

export function Section({ title, count, children, defaultOpen = true }: { title: string; count?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={styles.section}>
      <button type="button" className={styles.sectionHeader} onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{title}</span>
        {count !== undefined && <span className={styles.sectionCount}>{count}</span>}
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </section>
  );
}

export function TaskPanel({ state, onClose }: { state: Exclude<TaskPanelState, { mode: 'closed' }>; onClose: () => void }) {
  const { data: tasks, isLoading } = useTasks();
  if (state.mode === 'edit') {
    const task = tasks?.find((item) => item.id === state.taskId);
    return (
      <SidePanel open onClose={onClose}>
        {task ? <EditTask task={task} tasks={tasks ?? []} onClose={onClose} /> : isLoading ? <LoadingBlock /> : null}
      </SidePanel>
    );
  }
  return (
    <SidePanel open onClose={onClose} persistent>
      <NewTask defaults={state.defaults} onClose={onClose} />
    </SidePanel>
  );
}

function NewTask({ defaults, onClose }: { defaults: Partial<TaskDraft>; onClose: () => void }) {
  const t = useT();
  const user = useCurrentUser();
  const createTask = useCreateTask();
  const [showNotes, setShowNotes] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>({
    name: '',
    description: '',
    notes: '',
    projectId: null,
    parentId: null,
    startDate: null,
    dueDate: null,
    estimateSeconds: null,
    estimateMode: 'total',
    priority: 0,
    tagIds: [],
    assigneeIds: [user.id],
    status: 'todo',
    billable: false,
    isMilestone: false,
    allowNonWorkingDays: false,
    progress: 0,
    ...defaults,
  });
  const update = (change: Partial<TaskDraft>) => setDraft((current) => ({ ...current, ...change }));
  const submit = () => {
    if (!draft.name.trim()) return;
    createTask.mutate(
      { ...draft, name: draft.name.trim() },
      {
        onSuccess: () => {
          toast.success(t.tasks.createTask);
          onClose();
        },
      },
    );
  };

  return (
    <>
      <header className={styles.header}>
        <StatusIcon status={draft.status} size={18} />
        <span className={styles.headerTitle}>{t.tasks.newTask}</span>
        <IconButton icon={<X />} label={t.common.close} size="sm" onClick={onClose} />
      </header>
      <div className={styles.body}>
        <AutoTextArea
          className={styles.name}
          value={draft.name}
          placeholder={t.tasks.namePlaceholder}
          onChange={(name) => update({ name: name.replace(/\n/g, ' ') })}
          autoFocus
        />
        <AutoTextArea
          className={styles.description}
          value={draft.description}
          placeholder={t.tasks.descriptionPlaceholder}
          onChange={(description) => update({ description })}
        />
        <TaskFields values={draft} onChange={update} />
        {showNotes || draft.notes ? (
          <Section title={t.tasks.notes}>
            <AutoTextArea className={styles.notes} value={draft.notes} placeholder={t.tasks.notesPlaceholder} onChange={(notes) => update({ notes })} autoFocus />
          </Section>
        ) : (
          <div className={styles.extraActions}>
            <Button size="sm" icon={<NotebookPen />} onClick={() => setShowNotes(true)}>
              {t.tasks.addNotes}
            </Button>
          </div>
        )}
      </div>
      <footer className={styles.footer}>
        <Button variant="ghost" onClick={onClose}>
          {t.common.cancel}
        </Button>
        <Button variant="primary" onClick={submit} disabled={!draft.name.trim()} loading={createTask.isPending}>
          {t.tasks.createTask}
        </Button>
      </footer>
    </>
  );
}

function EditTask({ task, tasks, onClose }: { task: Task; tasks: Task[]; onClose: () => void }) {
  const t = useT();
  const format = useFormat();
  const confirm = useConfirm();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createTask = useCreateTask();
  const { data: running } = useRunningTimer();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const panel = useTaskPanel();
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description);
  const [notes, setNotes] = useState(task.notes);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => setName(task.name), [task.name]);
  useEffect(() => setDescription(task.description), [task.description]);
  useEffect(() => setNotes(task.notes), [task.notes]);

  const children = tasks.filter((item) => item.parentId === task.id);
  const isSummary = children.length > 0;
  const parent = task.parentId ? tasks.find((item) => item.id === task.parentId) : undefined;
  const timerHere = running?.taskId === task.id;

  const save = (change: Partial<TaskDraft>) => updateTask.mutate({ id: task.id, ...change });

  const remove = async () => {
    const ok = await confirm({ title: t.tasks.deleteTitle, text: t.tasks.deleteText, confirmLabel: t.common.delete, danger: true });
    if (!ok) return;
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast.success(t.tasks.deleted);
        onClose();
      },
    });
  };

  const duplicate = () =>
    createTask.mutate(
      { ...draftFrom(task), name: `${task.name} (2)`, status: 'todo', progress: 0 },
      { onSuccess: () => toast.success(t.common.duplicate) },
    );

  const trackedRatio = task.estimateSeconds ? Math.min(1, task.trackedSeconds / task.estimateSeconds) : 0;

  return (
    <>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.check}
          onClick={() => save({ status: task.status === 'done' ? 'todo' : 'done' })}
          aria-label={task.status === 'done' ? t.tasks.reopen : t.tasks.markDone}
          title={task.status === 'done' ? t.tasks.reopen : t.tasks.markDone}
        >
          <StatusIcon status={task.status} size={18} />
        </button>
        <span className={styles.headerTitle}>
          {parent ? (
            <button type="button" className={styles.breadcrumb} onClick={() => panel.openTask(parent.id)}>
              {parent.name}
            </button>
          ) : (
            t.tasks.title
          )}
        </span>
        <Menu
          placement="bottom-end"
          trigger={({ ref, getProps }) => (
            <IconButton ref={ref} icon={<MoreHorizontal />} label={t.common.more} size="sm" {...getProps()} />
          )}
          items={[
            { key: 'dup', label: t.common.duplicate, icon: <Copy />, onSelect: duplicate },
            { key: 'del', label: t.tasks.deleteTask, icon: <Trash2 />, danger: true, onSelect: () => void remove() },
          ]}
        />
        <IconButton icon={<X />} label={t.common.close} size="sm" onClick={onClose} />
      </header>
      <div className={styles.body}>
        <AutoTextArea
          className={styles.name}
          value={name}
          placeholder={t.tasks.namePlaceholder}
          onChange={(value) => setName(value.replace(/\n/g, ' '))}
          onBlur={() => name.trim() && name !== task.name && save({ name: name.trim() })}
        />
        <AutoTextArea
          className={styles.description}
          value={description}
          placeholder={t.tasks.descriptionPlaceholder}
          onChange={setDescription}
          onBlur={() => description !== task.description && save({ description })}
        />

        <div className={styles.tracked}>
          <div className={styles.trackedInfo}>
            <span className={styles.trackedLabel}>{t.tasks.tracked}</span>
            <span className="tabular">
              {task.estimateSeconds
                ? t.tasks.trackedOf(format.hours(task.trackedSeconds), format.hours(task.estimateSeconds))
                : format.hours(task.trackedSeconds)}
            </span>
            {task.estimateSeconds ? (
              <span className={styles.trackedBar}>
                <span
                  style={{ width: `${trackedRatio * 100}%` }}
                  className={task.trackedSeconds > task.estimateSeconds ? styles.trackedOver : undefined}
                />
              </span>
            ) : null}
          </div>
          {timerHere ? (
            <Button size="sm" variant="primary" icon={<Square fill="currentColor" />} onClick={() => running && stopTimer.mutate(running)}>
              {t.tasks.stopTimer}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="subtle"
              icon={<Play fill="currentColor" />}
              onClick={() => startTimer.mutate({ taskId: task.id, description: task.name })}
            >
              {t.tasks.startTimer}
            </Button>
          )}
        </div>

        <TaskFields values={draftFrom(task)} onChange={save} isSummary={isSummary} showProgress />

        <SubtaskSection task={task} subtasks={children} />
        <DependencySection task={task} tasks={tasks} />
        <AllocationSection task={task} tasks={tasks} />

        {showNotes || task.notes ? (
          <Section title={t.tasks.notes}>
            <AutoTextArea
              className={styles.notes}
              value={notes}
              placeholder={t.tasks.notesPlaceholder}
              onChange={setNotes}
              onBlur={() => notes !== task.notes && save({ notes })}
              autoFocus={showNotes && !task.notes}
            />
          </Section>
        ) : (
          <div className={styles.extraActions}>
            <Button size="sm" icon={<NotebookPen />} onClick={() => setShowNotes(true)}>
              {t.tasks.addNotes}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
