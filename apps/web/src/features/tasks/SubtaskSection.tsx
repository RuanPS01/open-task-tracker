import type { Task } from '@ott/shared';
import { useT } from '../../i18n';
import { SubtaskChecklist } from './SubtaskChecklist';
import { Section } from './TaskPanel';

/** Seção Subtarefas do painel: a mesma lista do cartão do Quadro, em tamanho normal. */
export function SubtaskSection({ task, subtasks }: { task: Task; subtasks: Task[] }) {
  const t = useT();
  const done = subtasks.filter((item) => item.status === 'done').length;
  return (
    <Section title={t.tasks.subtasks} count={subtasks.length > 0 ? t.tasks.subtaskCount(done, subtasks.length) : undefined} defaultOpen={subtasks.length > 0}>
      <SubtaskChecklist parent={task} subtasks={subtasks} />
    </Section>
  );
}
