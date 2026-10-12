import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  loading,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(styles.button, styles[variant], styles[size], !children && styles.iconOnly, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden /> : icon}
      {children}
      {iconRight}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon'> {
  icon: ReactNode;
  label: string;
  active?: boolean;
}

/** Botão só com ícone. O rótulo vira aria-label e title (dica nativa). */
export function IconButton({ icon, label, active, variant = 'ghost', className, ...rest }: IconButtonProps) {
  return (
    <Button
      variant={variant}
      aria-label={label}
      title={label}
      icon={icon}
      className={clsx(active && styles.active, className)}
      {...rest}
    />
  );
}
