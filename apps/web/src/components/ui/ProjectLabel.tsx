import clsx from 'clsx';
import styles from './ProjectLabel.module.css';

export function ColorDot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className={styles.dot} style={{ width: size, height: size, background: color }} aria-hidden />;
}

/** Nome do projeto na cor dele (padrão do Toggl em listas e no cronômetro). */
export function ProjectLabel({
  name,
  color,
  taskName,
  clientName,
  className,
  muted,
}: {
  name: string;
  color: string;
  taskName?: string | null;
  clientName?: string | null;
  className?: string;
  muted?: boolean;
}) {
  return (
    <span className={clsx(styles.label, className)} style={{ ['--project-color' as string]: color }}>
      <ColorDot color={color} />
      <span className={clsx(styles.name, muted && styles.muted)}>{name}</span>
      {taskName && <span className={styles.task}>: {taskName}</span>}
      {clientName && <span className={styles.client}>{clientName}</span>}
    </span>
  );
}
