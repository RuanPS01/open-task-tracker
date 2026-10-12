import { PRIORITIES, PRIORITY_KEYS, TASK_STATUSES, type Priority, type TaskStatus } from '@ott/shared';
import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { Menu } from '../ui/Menu';
import type { PopoverTriggerProps } from '../ui/Popover';
import { PriorityIcon, StatusIcon } from './TaskIcons';

export function StatusMenu({
  value,
  onChange,
  trigger,
}: {
  value: TaskStatus;
  onChange: (value: TaskStatus) => void;
  trigger: (props: PopoverTriggerProps) => ReactNode;
}) {
  const t = useT();
  return (
    <Menu
      trigger={trigger}
      width={200}
      items={TASK_STATUSES.map((status) => ({
        key: status,
        label: t.tasks.statusLabels[status],
        icon: <StatusIcon status={status} />,
        checked: status === value,
        onSelect: () => onChange(status),
      }))}
    />
  );
}

export function PriorityMenu({
  value,
  onChange,
  trigger,
}: {
  value: Priority;
  onChange: (value: Priority) => void;
  trigger: (props: PopoverTriggerProps) => ReactNode;
}) {
  const t = useT();
  return (
    <Menu
      trigger={trigger}
      width={200}
      items={[...PRIORITIES].reverse().map((priority) => ({
        key: String(priority),
        label: t.tasks.priorityLabels[PRIORITY_KEYS[priority]],
        icon: <PriorityIcon priority={priority} />,
        checked: priority === value,
        onSelect: () => onChange(priority),
      }))}
    />
  );
}
