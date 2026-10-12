// Peças da barra de ferramentas das páginas (o padrão "Filtros", "Agrupar por: Data").
import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import styles from './Toolbar.module.css';

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx(styles.toolbar, className)}>{children}</div>;
}

export function ToolbarSpacer() {
  return <div className={styles.spacer} />;
}

export function ToolbarDivider() {
  return <div className={styles.divider} />;
}

export interface ChipButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  icon?: ReactNode;
  label: ReactNode;
  value?: ReactNode;
  count?: number;
  active?: boolean;
  trailing?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function ChipButton({ icon, label, value, count, active, trailing, className, type = 'button', ...rest }: ChipButtonProps) {
  return (
    <button type={type} className={clsx(styles.chip, active && styles.active, className)} {...rest}>
      {icon}
      <span className={styles.chipLabel}>
        {label}
        {value !== undefined && <span className={styles.chipValue}>{value}</span>}
      </span>
      {count !== undefined && count > 0 && <span className={styles.count}>{count}</span>}
      {trailing}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode; icon?: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={clsx(styles.segmented, size === 'sm' && styles.segmentedSm)} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          title={option.title}
          className={clsx(styles.segment, option.value === value && styles.segmentActive)}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label && <span>{option.label}</span>}
        </button>
      ))}
    </div>
  );
}
