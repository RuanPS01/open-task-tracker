// Cartão do Quadro, no estilo do Trello: projeto, nome, selos (prioridade, entrega,
// tempo, descrição, subtarefas, cronômetro) e pessoas. As subtarefas ficam dentro do
// cartão da mãe, numa lista que abre pelo selo "2/5" ou pelo botão de acrescentar, com o
// status de cada uma. O arraste é do TaskBoard (useBoardDrag); aqui só o desenho.
import { toIsoDate, type Member, type Task } from '@ott/shared';
import clsx from 'clsx';
import { AlignLeft, Diamond, ListChecks, ListPlus, Play } from 'lucide-react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { PriorityIcon } from '../../components/pickers/TaskIcons';
import { AvatarStack } from '../../components/ui/Avatar';
import { ProjectLabel } from '../../components/ui/ProjectLabel';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { SubtaskChecklist } from './SubtaskChecklist';
import type { TaskRowContext } from './TaskRow';
import { isInteractive } from './useBoardDrag';
import styles from './TaskBoard.module.css';

const ARROWS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export interface BoardCardProps {
  task: Task;
  subtasks: readonly Task[];
  context: TaskRowContext;
  hideProject?: boolean;
  /** Cronômetro rodando nesta tarefa. */
  timerRunning?: boolean;
  /** Lista de subtarefas aberta, e se o campo de nova subtarefa recebe o foco. */
  expanded?: boolean;
  focusAdd?: boolean;
  onExpand?: (expanded: boolean, focusAdd?: boolean) => void;
  onOpen?: () => void;
  /** Alt + setas: mover o cartão sem mouse (acima, abaixo, coluna anterior, próxima). */
  onMoveKey?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  /** Cartão que está sendo arrastado: fica no lugar, escondido, enquanto o fantasma anda. */
  hidden?: boolean;
  /** Cópia que segue o ponteiro durante o arraste (sem ações). */
  ghost?: boolean;
}

export function BoardCard({
  task,
  subtasks,
  context,
  hideProject = false,
  timerRunning = false,
  expanded = false,
  focusAdd = false,
  onExpand,
  onOpen,
  onMoveKey,
  onPointerDown,
  hidden = false,
  ghost = false,
}: BoardCardProps) {
  const t = useT();
  const format = useFormat();
  const project = !hideProject && task.projectId ? context.projects.get(task.projectId) : undefined;
  const parent = task.parentId ? context.parents.get(task.parentId) : undefined;
  const assignees = task.assigneeIds
    .map((id) => context.members.get(id))
    .filter((member): member is Member => Boolean(member))
    .map((member) => ({ id: member.userId, name: member.name, avatarColor: member.avatarColor }));
  const today = toIsoDate(new Date());
  const due = task.dueDate;
  const isDone = task.status === 'done';
  const done = subtasks.filter((item) => item.status === 'done').length;
  const open = expanded && !ghost;

  // Cliques nos controles do cartão (e nos menus que eles abrem, que chegam aqui pelo
  // portal do React) não abrem o painel.
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (!event.currentTarget.contains(target) || isInteractive(target, event.currentTarget)) return;
    onOpen?.();
  };
  const handleKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') onOpen?.();
    const direction = event.altKey ? ARROWS[event.key] : undefined;
    if (direction && onMoveKey) {
      event.preventDefault();
      onMoveKey(direction);
    }
  };

  return (
    <article
      data-card-id={ghost ? undefined : task.id}
      className={clsx(styles.card, hidden && styles.dragSource, ghost && styles.ghostCard, isDone && styles.cardDone)}
      tabIndex={ghost ? -1 : 0}
      aria-label={task.name}
      aria-keyshortcuts={ghost ? undefined : 'Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight'}
      onPointerDown={onPointerDown}
      onClick={handleClick}
      onKeyDown={handleKey}
    >
      {!ghost && (
        <button
          type="button"
          className={styles.cardAction}
          aria-label={t.tasks.addSubtask}
          title={t.tasks.addSubtask}
          onClick={() => onExpand?.(true, true)}
        >
          <ListPlus size={14} />
        </button>
      )}
      {(project || parent) && (
        <div className={styles.cardTop}>
          {project && <ProjectLabel name={project.name} color={project.color} className={styles.cardProject} />}
          {parent && <span className={styles.cardParent}>{parent.name} /</span>}
        </div>
      )}
      <div className={styles.cardName}>
        {task.isMilestone && <Diamond size={12} className={styles.milestone} />}
        {task.name}
      </div>
      <footer className={styles.cardFooter}>
        {task.priority > 0 && <PriorityIcon priority={task.priority} />}
        {due && (
          <span className={clsx(styles.badge, due < today && !isDone && styles.overdue)}>
            {due === today ? t.common.today : format.dayMonth(due)}
          </span>
        )}
        {task.estimateSeconds ? (
          <span className={clsx(styles.badge, 'tabular', task.trackedSeconds > task.estimateSeconds && styles.overdue)}>
            {task.trackedSeconds > 0 ? `${format.hours(task.trackedSeconds)} / ${format.hours(task.estimateSeconds)}` : format.hours(task.estimateSeconds)}
          </span>
        ) : task.trackedSeconds > 0 ? (
          <span className={clsx(styles.badge, 'tabular')}>{format.hours(task.trackedSeconds)}</span>
        ) : null}
        {task.description.trim() && (
          <span className={styles.badge} title={t.tasks.cardHasDescription} aria-label={t.tasks.cardHasDescription}>
            <AlignLeft size={13} />
          </span>
        )}
        {subtasks.length > 0 && (
          <button
            type="button"
            className={clsx(styles.badge, styles.badgeButton, done === subtasks.length && styles.badgeDone)}
            aria-expanded={open}
            title={open ? t.tasks.cardHideSubtasks : t.tasks.cardShowSubtasks}
            aria-label={`${open ? t.tasks.cardHideSubtasks : t.tasks.cardShowSubtasks} (${t.tasks.subtaskCount(done, subtasks.length)})`}
            onClick={() => onExpand?.(!expanded)}
          >
            <ListChecks size={13} />
            <span className="tabular">{t.tasks.subtaskCount(done, subtasks.length)}</span>
          </button>
        )}
        {timerRunning && (
          <span className={clsx(styles.badge, styles.badgeTimer)} title={t.tasks.linkedTimer} aria-label={t.tasks.linkedTimer}>
            <Play size={11} fill="currentColor" />
          </span>
        )}
        <span className={styles.spacer} />
        {assignees.length > 0 && <AvatarStack people={assignees} size={20} max={3} />}
      </footer>
      {open && (
        <div className={styles.cardChecklist} data-no-drag>
          <SubtaskChecklist
            parent={task}
            subtasks={subtasks}
            compact
            autoFocus={focusAdd}
            onEmptyBlur={() => subtasks.length === 0 && onExpand?.(false)}
          />
        </div>
      )}
    </article>
  );
}
