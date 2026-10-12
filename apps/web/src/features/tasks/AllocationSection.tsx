// Alocação: como a estimativa se distribui pelos dias úteis, por responsável.
// Usa o mesmo cálculo da Linha do tempo (computeAllocations do pacote shared).
import { calendarFor, computeAllocations, UNASSIGNED, workdaysBetween, type Task } from '@ott/shared';
import { useMembers } from '../../api/workspace';
import { useWorkCalendar } from '../../lib/calendar';
import { Avatar } from '../../components/ui/Avatar';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { Section } from './TaskPanel';
import styles from './TaskPanel.module.css';

export function AllocationSection({ task, tasks }: { task: Task; tasks: Task[] }) {
  const t = useT();
  const format = useFormat();
  const { calendar } = useWorkCalendar();
  const { data: members = [] } = useMembers();
  const isParent = tasks.some((item) => item.parentId === task.id);
  const ready = !isParent && task.startDate && task.dueDate && task.estimateSeconds;
  const result = ready
    ? computeAllocations([{ ...task, status: 'todo' }], { start: task.startDate!, end: task.dueDate! }, calendar)
    : null;
  const perUser = result?.byTask.get(task.id);
  const workdays = ready ? workdaysBetween(task.startDate!, task.dueDate!, calendarFor(task, calendar)) : 0;

  return (
    <Section title={t.tasks.allocation} defaultOpen={false}>
      {!perUser ? (
        <p className={styles.muted}>{t.tasks.allocationEmpty}</p>
      ) : (
        <>
          <p className={styles.muted}>{t.tasks.allocationHint}</p>
          {[...perUser.entries()].map(([userId, seconds]) => {
            const member = members.find((m) => m.userId === userId);
            return (
              <div key={userId} className={styles.allocation}>
                {member ? <Avatar name={member.name} color={member.avatarColor} size={20} /> : null}
                <span className={styles.allocationName}>{userId === UNASSIGNED ? t.tasks.unassigned : (member?.name ?? '?')}</span>
                <span className={styles.muted}>{t.tasks.perDay(format.hours(seconds / Math.max(1, workdays)))}</span>
                <strong className="tabular">{format.hours(seconds)}</strong>
              </div>
            );
          })}
        </>
      )}
    </Section>
  );
}
