// Lista de subtarefas de uma tarefa, com o status de cada uma (menu completo, com os
// status customizados que valem no projeto) e o campo para acrescentar mais. Usada no
// painel da tarefa e dentro do cartão do Quadro. Cada subtarefa é uma tarefa de verdade:
// a alteração grava na hora, e a tarefa-mãe recalcula o status dela pelas filhas.
import type { Task } from '@ott/shared';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useCreateTask, useUpdateTask } from '../../data/tasks';
import { StatusMenu } from '../../components/pickers/StatusPriority';
import { TaskStatusIcon, statusInput, useStatusCatalog } from '../../components/pickers/TaskStatus';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useTaskPanel } from './TaskPanelContext';
import styles from './SubtaskChecklist.module.css';

export function SubtaskChecklist({
  parent,
  subtasks,
  compact = false,
  autoFocus = false,
  onEmptyBlur,
}: {
  parent: Task;
  subtasks: readonly Task[];
  /** Versão do cartão do Quadro: barra de progresso e linhas menores. */
  compact?: boolean;
  autoFocus?: boolean;
  /** O campo de nova subtarefa perdeu o foco vazio (o cartão fecha a lista se não houver nenhuma). */
  onEmptyBlur?: () => void;
}) {
  const t = useT();
  const format = useFormat();
  const panel = useTaskPanel();
  const catalog = useStatusCatalog();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const [name, setName] = useState('');
  const done = subtasks.filter((item) => item.status === 'done').length;

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    createTask.mutate({ name: trimmed, parentId: parent.id, assigneeIds: parent.assigneeIds });
    setName('');
    return true;
  };

  return (
    <div className={clsx(styles.checklist, compact && styles.compact)}>
      {compact && subtasks.length > 0 && (
        <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={subtasks.length} aria-valuenow={done} aria-label={t.tasks.subtasks}>
          <span className={clsx(done === subtasks.length && styles.progressDone)} style={{ width: `${(done / subtasks.length) * 100}%` }} />
        </div>
      )}
      {subtasks.map((subtask) => {
        const status = catalog.forTask(subtask);
        return (
          <div key={subtask.id} className={styles.row}>
            <StatusMenu
              projectId={subtask.projectId}
              value={status.key}
              onChange={(option) => option.key !== status.key && updateTask.mutate({ id: subtask.id, ...statusInput(option) })}
              trigger={({ ref, getProps }) => (
                <button
                  ref={ref}
                  type="button"
                  className={styles.status}
                  aria-label={t.tasks.subtaskStatus(subtask.name, status.label)}
                  title={status.label}
                  {...getProps()}
                >
                  <TaskStatusIcon task={subtask} size={compact ? 15 : 16} />
                </button>
              )}
            />
            <button type="button" className={styles.name} data-done={subtask.status === 'done'} onClick={() => panel.openTask(subtask.id)}>
              {subtask.name}
            </button>
            {subtask.dueDate && <span className={styles.meta}>{format.dayMonth(subtask.dueDate)}</span>}
          </div>
        );
      })}
      <div className={styles.add}>
        <Plus size={14} />
        <input
          value={name}
          placeholder={t.tasks.addSubtask}
          aria-label={t.tasks.addSubtask}
          autoFocus={autoFocus}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            } else if (event.key === 'Escape' && compact) {
              event.stopPropagation();
              setName('');
              event.currentTarget.blur();
            }
          }}
          onBlur={() => {
            if (!add()) onEmptyBlur?.();
          }}
        />
      </div>
    </div>
  );
}
