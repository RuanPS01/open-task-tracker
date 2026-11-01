// Quadro (kanban) por status: uma coluna para cada status padrão e para os customizados
// (do workspace e do projeto). Arrastar um cartão para outra coluna muda o status; status
// de um projeto não aceita tarefa de outro.
import { statusAppliesTo, toIsoDate, type Id, type Member, type Task } from '@ott/shared';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useUpdateTask } from '../../data/tasks';
import { PriorityIcon } from '../../components/pickers/TaskIcons';
import { StatusOptionIcon, statusInput, useStatusCatalog } from '../../components/pickers/TaskStatus';
import { AvatarStack } from '../../components/ui/Avatar';
import { ProjectLabel } from '../../components/ui/ProjectLabel';
import { toast } from '../../components/ui/Toast';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import type { TaskRowContext } from './TaskRow';
import { effectiveStatusKey, statusOrder } from './taskGrouping';
import { useTaskPanel } from './TaskPanelContext';
import styles from './TaskBoard.module.css';

export function TaskBoard({ tasks, context, defaults }: { tasks: Task[]; context: TaskRowContext; defaults?: { projectId?: Id } }) {
  const t = useT();
  const format = useFormat();
  const panel = useTaskPanel();
  const update = useUpdateTask();
  const [dragging, setDragging] = useState<Id | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const catalog = useStatusCatalog();
  const known = new Set(catalog.byId.keys());
  const today = toIsoDate(new Date());
  const columns = statusOrder(catalog.statuses, tasks, defaults?.projectId).map(catalog.option);

  return (
    <div className={styles.board}>
      {columns.map((option) => {
        const status = option.category;
        const column = tasks.filter((task) => effectiveStatusKey(task, known) === option.key);
        return (
          <section
            key={option.key}
            className={clsx(styles.column, over === option.key && styles.over)}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(option.key);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(event) => {
              event.preventDefault();
              setOver(null);
              const id = event.dataTransfer.getData('text/task-id');
              const task = tasks.find((item) => item.id === id);
              if (!task || effectiveStatusKey(task, known) === option.key) return;
              if (option.custom && !statusAppliesTo(option.custom, task.projectId)) {
                toast.error(t.statuses.notInProject);
                return;
              }
              update.mutate({ id, ...statusInput(option) });
            }}
          >
            <header className={styles.columnHeader}>
              <StatusOptionIcon option={option} />
              <span>{option.label}</span>
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
              <button type="button" className={styles.add} onClick={() => panel.openNew({ ...statusInput(option), ...defaults })}>
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
