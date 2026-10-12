// Quadro (kanban) por status. Arrastar um cartão para outra coluna muda o status.
import { TASK_STATUSES, toIsoDate, type Id, type Member, type Task, type TaskStatus } from '@ott/shared';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useUpdateTask } from '../../data/tasks';
import { PriorityIcon, StatusIcon } from '../../components/pickers/TaskIcons';
import { AvatarStack } from '../../components/ui/Avatar';
import { ProjectLabel } from '../../components/ui/ProjectLabel';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import type { TaskRowContext } from './TaskRow';
import { useTaskPanel } from './TaskPanelContext';
import styles from './TaskBoard.module.css';

export function TaskBoard({ tasks, context, defaults }: { tasks: Task[]; context: TaskRowContext; defaults?: { projectId?: Id } }) {
  const t = useT();
  const format = useFormat();
  const panel = useTaskPanel();
  const update = useUpdateTask();
  const [dragging, setDragging] = useState<Id | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const today = toIsoDate(new Date());

  return (
    <div className={styles.board}>
      {TASK_STATUSES.map((status) => {
        const column = tasks.filter((task) => task.status === status);
        return (
          <section
            key={status}
            className={clsx(styles.column, over === status && styles.over)}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(status);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(event) => {
              event.preventDefault();
              setOver(null);
              const id = event.dataTransfer.getData('text/task-id');
              const task = tasks.find((item) => item.id === id);
              if (task && task.status !== status) update.mutate({ id, status });
            }}
          >
            <header className={styles.columnHeader}>
              <StatusIcon status={status} />
              <span>{t.tasks.statusLabels[status]}</span>
              <span className={styles.count}>{column.length}</span>
            </header>
            <div className={styles.cards}>
              {column.map((task) => {
                const project = task.projectId ? context.projects.get(task.projectId) : undefined;
                const assignees = task.assigneeIds
                  .map((id) => context.members.get(id))
                  .filter((member): member is Member => Boolean(member))
                  .map((member) => ({ id: member.userId, name: member.name, avatarColor: member.avatarColor }));
                const due = task.dueDate;
                return (
                  <article
                    key={task.id}
                    className={clsx(styles.card, dragging === task.id && styles.dragging)}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/task-id', String(task.id));
                      event.dataTransfer.effectAllowed = 'move';
                      setDragging(task.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => panel.openTask(task.id)}
                  >
                    {project && <ProjectLabel name={project.name} color={project.color} className={styles.cardProject} />}
                    <div className={styles.cardName}>{task.name}</div>
                    <footer className={styles.cardFooter}>
                      {task.priority > 0 && <PriorityIcon priority={task.priority} />}
                      {due && <span className={clsx(styles.cardDate, due < today && status !== 'done' && styles.overdue)}>{format.dayMonth(due)}</span>}
                      {task.estimateSeconds ? <span className={styles.cardDate}>{format.hours(task.estimateSeconds)}</span> : null}
                      <span className={styles.spacer} />
                      {assignees.length > 0 && <AvatarStack people={assignees} size={20} max={3} />}
                    </footer>
                  </article>
                );
              })}
              <button type="button" className={styles.add} onClick={() => panel.openNew({ status, ...defaults })}>
                <Plus size={14} />
                {t.tasks.add}
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
