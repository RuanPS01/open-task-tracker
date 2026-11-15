// Janela da tarefa (modal centralizado, como o cartão aberto do Trello): à esquerda nome,
// descrição, tempo, subtarefas, dependências, alocação e notas; à direita as
// propriedades. Em telas estreitas vira uma coluna só. Tarefa nova trabalha num rascunho e só grava ao clicar em
// "Criar tarefa". Tarefa existente também: nome, descrição, propriedades e notas ficam
// num rascunho até "Salvar" (ou Ctrl+Enter), e fechar com alterações pendentes pergunta
// antes. Subtarefas, dependências, cronômetro e o botão de concluir agem na hora, porque
// são outros registros ou ações rápidas.
import type { Task } from '@ott/shared';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, Copy, MoreHorizontal, NotebookPen, Play, Square, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from '../../data/tasks';
import { useRunningTimer, useStartTimer, useStopTimer } from '../../data/timeEntries';
import { useCurrentUser } from '../../app/session';
import { TaskStatusIcon } from '../../components/pickers/TaskStatus';
import { Button, IconButton } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/Confirm';
import { LoadingBlock } from '../../components/ui/EmptyState';
import { Menu } from '../../components/ui/Menu';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { AllocationSection } from './AllocationSection';
import { DependencySection } from './DependencySection';
import { SubtaskSection } from './SubtaskSection';
import { TaskFields, type TaskDraft } from './TaskFields';
import { draftFrom, hasChanges, mergeChanges, withoutSaved, withoutStatus } from './taskDraft';
import { useTaskPanel, type TaskPanelState } from './TaskPanelContext';
import styles from './TaskPanel.module.css';

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
      <Modal open onClose={onClose} bare initialFocus={-1} className={styles.dialog}>
        {task ? <EditTask task={task} tasks={tasks ?? []} onClose={onClose} /> : isLoading ? <LoadingBlock /> : null}
      </Modal>
    );
  }
  return (
    <Modal open onClose={onClose} bare initialFocus={-1} persistent className={clsx(styles.dialog, styles.dialogNew)}>
      <NewTask defaults={state.defaults} onClose={onClose} />
    </Modal>
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
    statusId: null,
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
        <TaskStatusIcon task={draft} size={18} />
        <span className={styles.headerTitle}>{t.tasks.newTask}</span>
        <IconButton icon={<X />} label={t.common.close} size="sm" onClick={onClose} />
      </header>
      <div className={styles.content}>
        <div className={styles.main}>
          <div className={styles.top}>
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
          </div>
          <div className={styles.rest}>
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
        </div>
        <aside className={styles.side} aria-label={t.tasks.details}>
          <TaskFields values={draft} onChange={update} />
        </aside>
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

/** Mac usa Cmd no lugar de Ctrl nos atalhos. */
const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd' : 'Ctrl';

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
  const [changes, setChanges] = useState<Partial<TaskDraft>>({});
  const [showNotes, setShowNotes] = useState(false);
  /** Ação (fechar, abrir outra tarefa) segurada até a pessoa decidir o que fazer com o rascunho. */
  const [leaving, setLeaving] = useState<(() => void) | null>(null);

  const base = draftFrom(task);
  const values: TaskDraft = { ...base, ...changes };
  const dirty = hasChanges(changes);
  const nameMissing = !values.name.trim();

  const children = tasks.filter((item) => item.parentId === task.id);
  const isSummary = children.length > 0;
  const parent = task.parentId ? tasks.find((item) => item.id === task.parentId) : undefined;
  const timerHere = running?.taskId === task.id;

  const edit = (change: Partial<TaskDraft>) => setChanges((current) => mergeChanges(draftFrom(task), current, change));

  const save = (after?: () => void) => {
    if (!dirty || nameMissing) return;
    const saved = { ...changes, ...(changes.name !== undefined ? { name: changes.name.trim() } : {}) };
    updateTask.mutate(
      { id: task.id, ...saved },
      {
        onSuccess: () => {
          setChanges((current) => withoutSaved(current, { ...saved, ...(changes.name !== undefined ? { name: changes.name } : {}) }));
          toast.success(t.common.saved);
          after?.();
        },
      },
    );
  };

  const discard = () => setChanges({});

  // A guarda vê sempre o rascunho atual sem ser registrada de novo a cada tecla.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    panel.setGuard((proceed) => {
      if (!dirtyRef.current) return true;
      setLeaving(() => proceed);
      return false;
    });
    return () => panel.setGuard(null);
  }, [panel]);

  // Fechar a aba do navegador com alterações pendentes também avisa.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const leave = (choice: 'save' | 'discard' | 'stay') => {
    const proceed = leaving;
    setLeaving(null);
    if (choice === 'stay' || !proceed) return;
    if (choice === 'discard') {
      dirtyRef.current = false;
      discard();
      proceed();
      return;
    }
    save(() => {
      dirtyRef.current = false;
      proceed();
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const mod = event.ctrlKey || event.metaKey;
    if (mod && (event.key === 'Enter' || event.key.toLowerCase() === 's')) {
      event.preventDefault();
      save();
    }
  };

  const toggleDone = () => {
    // Ação rápida: grava na hora e tira do rascunho qualquer status escolhido antes.
    setChanges((current) => withoutStatus(current));
    updateTask.mutate({ id: task.id, status: task.status === 'done' ? 'todo' : 'done' });
  };

  const remove = async () => {
    const ok = await confirm({ title: t.tasks.deleteTitle, text: t.tasks.deleteText, confirmLabel: t.common.delete, danger: true });
    if (!ok) return;
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast.success(t.tasks.deleted);
        panel.setGuard(null);
        onClose();
      },
    });
  };

  const duplicate = () =>
    createTask.mutate(
      { ...values, name: `${values.name.trim() || task.name} (2)`, status: 'todo', statusId: null, progress: 0 },
      { onSuccess: () => toast.success(t.common.duplicate) },
    );

  const trackedRatio = task.estimateSeconds ? Math.min(1, task.trackedSeconds / task.estimateSeconds) : 0;

  return (
    <div className={styles.editor} onKeyDown={onKeyDown}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.check}
          onClick={toggleDone}
          aria-label={task.status === 'done' ? t.tasks.reopen : t.tasks.markDone}
          title={task.status === 'done' ? t.tasks.reopen : t.tasks.markDone}
        >
          <TaskStatusIcon task={values} size={18} />
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
        <IconButton icon={<X />} label={t.common.close} size="sm" onClick={() => panel.close()} />
      </header>
      <div className={styles.content}>
        <div className={styles.main}>
          <div className={styles.top}>
            <AutoTextArea
              className={styles.name}
              value={values.name}
              placeholder={t.tasks.namePlaceholder}
              onChange={(value) => edit({ name: value.replace(/\n/g, ' ') })}
            />
            <AutoTextArea
              className={styles.description}
              value={values.description}
              placeholder={t.tasks.descriptionPlaceholder}
              onChange={(description) => edit({ description })}
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
          </div>
          <div className={styles.rest}>
            <SubtaskSection task={task} subtasks={children} />
            <DependencySection task={task} tasks={tasks} />
            <AllocationSection task={task} tasks={tasks} />

            {showNotes || values.notes || task.notes ? (
              <Section title={t.tasks.notes}>
                <AutoTextArea
                  className={styles.notes}
                  value={values.notes}
                  placeholder={t.tasks.notesPlaceholder}
                  onChange={(notes) => edit({ notes })}
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
        </div>
        <aside className={styles.side} aria-label={t.tasks.details}>
          <TaskFields values={values} onChange={edit} isSummary={isSummary} showProgress />
        </aside>
      </div>
      <footer className={clsx(styles.footer, styles.saveBar, leaving && styles.saveBarAsk)} aria-live="polite">
        {leaving ? (
          <>
            <span className={styles.saveState} data-tone="warning">
              <span className={styles.saveLabel}>{t.tasks.unsavedTitle}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => leave('stay')}>
              {t.tasks.keepEditing}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => leave('discard')}>
              {t.tasks.discard}
            </Button>
            <Button size="sm" variant="primary" onClick={() => leave('save')} disabled={nameMissing} loading={updateTask.isPending} autoFocus>
              {t.common.save}
            </Button>
          </>
        ) : (
          <>
            <span className={styles.saveState} data-tone={nameMissing ? 'danger' : dirty ? 'warning' : undefined}>
              <span className={styles.saveLabel}>{nameMissing ? t.tasks.nameRequired : dirty ? t.tasks.unsaved : t.tasks.allSaved}</span>
              {dirty && !nameMissing && <span className={styles.saveHint}>{t.tasks.saveShortcut(MOD_KEY)}</span>}
            </span>
            {dirty && (
              <Button variant="ghost" onClick={discard}>
                {t.tasks.discard}
              </Button>
            )}
            <Button variant="primary" onClick={() => save()} disabled={!dirty || nameMissing} loading={updateTask.isPending}>
              {t.common.save}
            </Button>
          </>
        )}
      </footer>
    </div>
  );
}
