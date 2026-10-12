import type { Placement } from '@floating-ui/react';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Popover, type PopoverTriggerProps } from './Popover';
import styles from './Menu.module.css';

export interface MenuItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export type MenuEntry = MenuItem | 'separator' | { heading: string };

export interface MenuProps {
  trigger: (props: PopoverTriggerProps) => ReactNode;
  items: MenuEntry[];
  placement?: Placement;
  width?: number;
}

/** Menu suspenso com itens, separadores e títulos de seção. */
export function Menu({ trigger, items, placement = 'bottom-start', width }: MenuProps) {
  return (
    <Popover trigger={trigger} placement={placement} width={width} role="menu">
      {({ close }) => <MenuList items={items} onDone={close} />}
    </Popover>
  );
}

export function MenuList({ items, onDone }: { items: MenuEntry[]; onDone?: () => void }) {
  return (
    <div className={styles.list} role="menu">
      {items.map((item, index) => {
        if (item === 'separator') return <div key={`sep-${index}`} className={styles.separator} role="separator" />;
        if ('heading' in item) {
          return (
            <div key={`h-${index}`} className={styles.heading}>
              {item.heading}
            </div>
          );
        }
        return (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            className={clsx(styles.item, item.danger && styles.danger)}
            disabled={item.disabled}
            onClick={() => {
              item.onSelect();
              onDone?.();
            }}
          >
            {item.icon && <span className={styles.icon}>{item.icon}</span>}
            <span className={styles.label}>{item.label}</span>
            {item.hint && <span className={styles.hint}>{item.hint}</span>}
            {item.checked && <Check className={styles.check} size={14} />}
          </button>
        );
      })}
    </div>
  );
}
