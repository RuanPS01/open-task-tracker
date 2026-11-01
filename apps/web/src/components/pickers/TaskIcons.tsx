// Ícones de status e prioridade das tarefas, desenhados em SVG com tokens. Status
// customizado usa um dos três desenhos padrão ou um ícone do lucide-react, na cor que a
// equipe escolheu (uma das cores de projeto, que vem do dado).
import { PRIORITY_KEYS, type CustomStatus, type Priority, type StatusIconKey, type TaskStatus } from '@ott/shared';
import {
  Archive,
  Ban,
  Bug,
  Circle,
  CircleDot,
  CirclePause,
  CircleX,
  Clock,
  Code,
  Eye,
  Flag,
  Hourglass,
  Lock,
  MessageCircle,
  Package,
  PenLine,
  Rocket,
  Search,
  Send,
  Star,
  TestTube,
  ThumbsUp,
  TriangleAlert,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';

type ShapeKey = Extract<StatusIconKey, 'dashed' | 'half' | 'check'>;

const SHAPE_BY_STATUS: Record<TaskStatus, ShapeKey> = { todo: 'dashed', in_progress: 'half', done: 'check' };

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'var(--status-todo)',
  in_progress: 'var(--status-progress)',
  done: 'var(--status-done)',
};

// Ícones do lucide-react para os status customizados. O Record obriga a ter um ícone para
// cada chave de STATUS_ICONS (menos os três desenhos padrão).
const LUCIDE_ICONS: Record<Exclude<StatusIconKey, ShapeKey>, LucideIcon> = {
  circle: Circle,
  dot: CircleDot,
  pause: CirclePause,
  x: CircleX,
  eye: Eye,
  search: Search,
  clock: Clock,
  hourglass: Hourglass,
  ban: Ban,
  alert: TriangleAlert,
  flag: Flag,
  bug: Bug,
  code: Code,
  test: TestTube,
  pen: PenLine,
  message: MessageCircle,
  send: Send,
  'thumbs-up': ThumbsUp,
  users: Users,
  truck: Truck,
  package: Package,
  rocket: Rocket,
  star: Star,
  archive: Archive,
  lock: Lock,
};

const isShape = (icon: StatusIconKey): icon is ShapeKey => icon === 'dashed' || icon === 'half' || icon === 'check';

function StatusShape({ shape, color, size }: { shape: ShapeKey; color: string; size: number }) {
  if (shape === 'check') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="7" fill={color} />
        <path d="M4.8 8.2l2.1 2.1 4.3-4.5" stroke="var(--bg-app)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (shape === 'half') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="6.3" stroke={color} strokeWidth="1.5" fill="none" />
        <path d="M8 3.6a4.4 4.4 0 0 1 0 8.8z" fill={color} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6.3" stroke={color} strokeWidth="1.5" strokeDasharray="2.6 2" fill="none" />
    </svg>
  );
}

/**
 * Ícone do status. Sem `custom`, o desenho padrão da categoria; com ele, o ícone e a cor
 * do status customizado.
 */
export function StatusIcon({
  status,
  custom,
  size = 16,
}: {
  status: TaskStatus;
  custom?: Pick<CustomStatus, 'icon' | 'color'> | null;
  size?: number;
}) {
  if (!custom) return <StatusShape shape={SHAPE_BY_STATUS[status]} color={STATUS_COLORS[status]} size={size} />;
  return <StatusGlyph icon={custom.icon} color={custom.color} size={size} />;
}

/** Só o desenho de um ícone de status, em qualquer cor (seletor de ícone do status). */
export function StatusGlyph({ icon, color, size = 16 }: { icon: StatusIconKey; color: string; size?: number }) {
  if (isShape(icon)) return <StatusShape shape={icon} color={color} size={size} />;
  const Icon = LUCIDE_ICONS[icon];
  return <Icon size={size} color={color} strokeWidth={2.2} aria-hidden />;
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
