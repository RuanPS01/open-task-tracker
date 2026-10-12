import { toIsoDate, type Member, type Project, type Task } from '@ott/shared';
import clsx from 'clsx';
import { Diamond, GitBranch, Play, Square } from 'lucide-react';
import { useRunningTimer, useStartTimer, useStopTimer } from '../../api/timeEntries';
import { useUpdateTask } from '../../api/tasks';
import { PriorityIcon, StatusIcon } from '../../components/pickers/TaskIcons';
import { AvatarStack } from '../../components/ui/Avatar';
import { IconButton } from '../../components/ui/Button';
import { ProjectLabel } from '../../components/ui/ProjectLabel';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import styles from './TasksPage.module.css';

export interface TaskRowContext {
  projects: Map<number, Project>;
  members: Map<number, Member>;
  parents: Map<number, Task>;
  childCount: Map<number, { done: number; total: number }>;
}

/** Linha de tarefa da Lista (e do projeto): concluir, nome, projeto, datas, tempo, prioridade, pessoas. */
export function TaskRow({ task, context, onOpen, hideProject = false }: { task: Task; context: TaskRowContext; onOpen: () => void; hideProject?: boolean }) {
  const t = useT();
  const format = useFormat();
  const update = useUpdateTask();
  const { data: running } = useRunningTimer();
  const start = useStartTimer();
  const stop = useStopTimer();
  const project = task.projectId ? context.projects.get(task.projectId) : undefined;
  const parent = task.parentId ? context.parents.get(task.parentId) : undefined;
  const children = context.childCount.get(task.id);
  const assignees = task.assigneeIds
    .map((id) => context.members.get(id))
    .filter((member): member is Member => Boolean(member))
    .map((member) => ({ id: member.userId, name: member.name, avatarColor: member.avatarColor }));
  const today = toIsoDate(new Date());
  const due = task.dueDate ?? task.startDate;
  const overdue = due !== null && due < today && task.status !== 'done';
  const timerHere = running?.taskId === task.id;

  let dateText: string | null = null;
  if (task.startDate && task.dueDate && task.startDate !== task.dueDate) dateText = format.range(task.startDate, task.dueDate);
  else if (due) dateText = due === today ? t.common.today : format.dayMonth(due);

  return (
    <div className={clsx(styles.row, task.status === 'done' && styles.rowDone)} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && onOpen()}>
      <button
        type="button"
        className={styles.check}
        onClick={(event) => {
          event.stopPropagation();
          update.mutate({ id: task.id, status: task.status === 'done' ? 'todo' : 'done' });
        }}
        aria-label={task.status === 'done' ? t.tasks.reopen : t.tasks.markDone}
        title={task.status === 'done' ? t.tasks.reopen : t.tasks.markDone}
      >
        <StatusIcon status={task.status} />
      </button>
      <div className={styles.nameCell}>
        {parent && <span className={styles.parent}>{parent.name} /</span>}
        {task.isMilestone && <Diamond size={13} className={styles.milestone} />}
        <span className={styles.name}>{task.name}</span>
        {children && (
          <span className={styles.badge} title={t.tasks.subtasks}>
            <GitBranch size={12} />
            {t.tasks.subtaskCount(children.done, children.total)}
          </span>
        )}
      </div>
      <div className={styles.projectCell}>{!hideProject && project && <ProjectLabel name={project.name} color={project.color} />}</div>
      <div className={clsx(styles.dateCell, overdue && styles.overdue)}>{dateText}</div>
      <div className={styles.timeCell}>
        {task.estimateSeconds ? (
          <span className={task.trackedSeconds > task.estimateSeconds ? styles.overdue : undefined}>
            {format.hours(task.trackedSeconds)} / {format.hours(task.estimateSeconds)}
          </span>
        ) : task.trackedSeconds > 0 ? (
          format.hours(task.trackedSeconds)
        ) : null}
      </div>
      <div className={styles.priorityCell} title={t.tasks.priority}>
        {task.priority > 0 && <PriorityIcon priority={task.priority} />}
      </div>
      <div className={styles.peopleCell}>{assignees.length > 0 && <AvatarStack people={assignees} size={22} />}</div>
      <div className={styles.playCell} onClick={(event) => event.stopPropagation()}>
        {timerHere ? (
          <IconButton icon={<Square fill="currentColor" />} label={t.tasks.stopTimer} size="sm" variant="subtle" onClick={() => running && stop.mutate(running)} />
        ) : (
          <IconButton
            icon={<Play fill="currentColor" />}
            label={t.tasks.startTimer}
            size="sm"
            className={styles.play}
            onClick={() => start.mutate({ taskId: task.id, description: task.name })}
          />
        )}
      </div>
    </div>
  );
}
