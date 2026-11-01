import { PRIORITIES, PRIORITY_KEYS, type Id, type Priority } from '@ott/shared';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { Menu, type MenuEntry } from '../ui/Menu';
import type { PopoverTriggerProps } from '../ui/Popover';
import { PriorityIcon } from './TaskIcons';
import { StatusOptionIcon, useStatusCatalog, type StatusOption } from './TaskStatus';

/** Status disponíveis para uma tarefa do projeto: os padrão, os do workspace e os do projeto. */
export function StatusMenu({
  projectId,
  value,
  onChange,
  onCreate,
  trigger,
}: {
  projectId: Id | null;
  /** Chave do status atual: a categoria ou o id do status customizado. */
  value: string;
  onChange: (option: StatusOption) => void;
  /** Mostra "Novo status" no fim do menu. */
  onCreate?: () => void;
  trigger: (props: PopoverTriggerProps) => ReactNode;
}) {
  const t = useT();
  const catalog = useStatusCatalog();
  const items: MenuEntry[] = catalog.optionsFor(projectId).map((option) => ({
    key: option.key,
    label: option.label,
    icon: <StatusOptionIcon option={option} />,
    checked: option.key === value,
    onSelect: () => onChange(option),
  }));
  if (onCreate) items.push('separator', { key: 'new-status', label: t.statuses.create, icon: <Plus />, onSelect: onCreate });
  return <Menu trigger={trigger} width={220} items={items} />;
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
