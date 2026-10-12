import type { Task } from '@ott/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useCreateTask, useUpdateTask } from '../../data/tasks';
import { StatusIcon } from '../../components/pickers/TaskIcons';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { Section } from './TaskPanel';
import { useTaskPanel } from './TaskPanelContext';
import styles from './TaskPanel.module.css';

export function SubtaskSection({ task, subtasks }: { task: Task; subtasks: Task[] }) {
  const t = useT();
  const format = useFormat();
  const panel = useTaskPanel();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const [name, setName] = useState('');
  const done = subtasks.filter((item) => item.status === 'done').length;

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createTask.mutate({ name: trimmed, parentId: task.id, assigneeIds: task.assigneeIds });
    setName('');
  };

  return (
    <Section title={t.tasks.subtasks} count={subtasks.length > 0 ? t.tasks.subtaskCount(done, subtasks.length) : undefined} defaultOpen={subtasks.length > 0}>
      <div className={styles.subtasks}>
        {subtasks.map((subtask) => (
          <div key={subtask.id} className={styles.subtask}>
            <button
              type="button"
              className={styles.check}
              onClick={() => updateTask.mutate({ id: subtask.id, status: subtask.status === 'done' ? 'todo' : 'done' })}
              aria-label={subtask.status === 'done' ? t.tasks.reopen : t.tasks.markDone}
            >
              <StatusIcon status={subtask.status} />
            </button>
            <button type="button" className={styles.subtaskName} data-done={subtask.status === 'done'} onClick={() => panel.openTask(subtask.id)}>
              {subtask.name}
            </button>
            {subtask.dueDate && <span className={styles.subtaskMeta}>{format.dayMonth(subtask.dueDate)}</span>}
          </div>
        ))}
        <div className={styles.subtaskAdd}>
          <Plus size={14} />
          <input
            value={name}
            placeholder={t.tasks.addSubtask}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && add()}
            onBlur={add}
          />
        </div>
      </div>
    </Section>
  );
}
