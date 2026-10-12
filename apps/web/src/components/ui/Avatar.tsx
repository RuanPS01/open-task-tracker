import type { Id } from '@ott/shared';
import clsx from 'clsx';
import styles from './Avatar.module.css';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function Avatar({
  name,
  color,
  size = 24,
  className,
  title,
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={clsx(styles.avatar, className)}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)), ['--avatar-color' as string]: color }}
      title={title ?? name}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 4,
  size = 22,
}: {
  people: { id: Id; name: string; avatarColor: string }[];
  max?: number;
  size?: number;
}) {
  const visible = people.slice(0, max);
  const rest = people.length - visible.length;
  return (
    <span className={styles.stack}>
      {visible.map((person) => (
        <Avatar key={person.id} name={person.name} color={person.avatarColor} size={size} className={styles.stacked} />
      ))}
      {rest > 0 && (
        <span className={clsx(styles.avatar, styles.stacked, styles.more)} style={{ width: size, height: size }}>
          +{rest}
        </span>
      )}
    </span>
  );
}
