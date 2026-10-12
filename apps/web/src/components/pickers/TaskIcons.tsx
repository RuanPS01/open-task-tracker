// Ícones de status e prioridade das tarefas, desenhados em SVG com tokens.
import { PRIORITY_KEYS, type Priority, type TaskStatus } from '@ott/shared';

export function StatusIcon({ status, size = 16 }: { status: TaskStatus; size?: number }) {
  if (status === 'done') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="7" fill="var(--status-done)" />
        <path d="M4.8 8.2l2.1 2.1 4.3-4.5" stroke="var(--bg-app)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'in_progress') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="6.3" stroke="var(--status-progress)" strokeWidth="1.5" fill="none" />
        <path d="M8 3.6a4.4 4.4 0 0 1 0 8.8z" fill="var(--status-progress)" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6.3" stroke="var(--status-todo)" strokeWidth="1.5" strokeDasharray="2.6 2" fill="none" />
    </svg>
  );
}

const PRIORITY_COLORS: Record<Priority, string> = {
  0: 'var(--text-faint)',
  1: 'var(--priority-low)',
  2: 'var(--priority-medium)',
  3: 'var(--priority-high)',
  4: 'var(--priority-urgent)',
};

export function PriorityIcon({ priority, size = 16 }: { priority: Priority; size?: number }) {
  if (priority === 4) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
        <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill={PRIORITY_COLORS[4]} />
        <path d="M8 4.5v4.5" stroke="var(--bg-app)" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="8" cy="11.6" r="1.1" fill="var(--bg-app)" />
      </svg>
    );
  }
  const filled = priority;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden data-priority={PRIORITY_KEYS[priority]}>
      {[0, 1, 2].map((index) => (
        <rect
          key={index}
          x={2.5 + index * 4}
          y={10 - index * 3.5}
          width="2.6"
          height={4 + index * 3.5}
          rx="1"
          fill={index < filled ? PRIORITY_COLORS[priority] : 'var(--border-strong)'}
        />
      ))}
    </svg>
  );
}
