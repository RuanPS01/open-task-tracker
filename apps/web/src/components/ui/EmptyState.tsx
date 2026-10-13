import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export type IllustrationKind = 'shapes' | 'people' | 'clock' | 'chart' | 'folders';

/** Ilustrações geométricas no estilo das telas vazias do Toggl, desenhadas com tokens. */
export function Illustration({ kind }: { kind: IllustrationKind }) {
  if (kind === 'people') {
    return (
      <svg width="120" height="96" viewBox="0 0 120 96" aria-hidden>
        <circle cx="36" cy="38" r="16" fill="var(--brand-yellow)" />
        <circle cx="60" cy="22" r="16" fill="var(--brand-light)" />
        <circle cx="52" cy="64" r="14" fill="var(--brand-deep)" />
        <rect x="78" y="30" width="22" height="56" rx="11" fill="var(--accent)" />
        <circle cx="89" cy="20" r="9" fill="var(--brand-yellow)" />
      </svg>
    );
  }
  if (kind === 'clock') {
    return (
      <svg width="132" height="104" viewBox="0 0 132 104" aria-hidden>
        <rect x="8" y="58" width="40" height="40" rx="6" fill="var(--brand-deep)" />
        <circle cx="74" cy="50" r="40" fill="var(--accent)" />
        <circle cx="74" cy="50" r="28" fill="var(--bg-app)" />
        <path d="M74 32v18l12 8" stroke="var(--brand-yellow)" strokeWidth="7" strokeLinecap="round" fill="none" />
        <polygon points="112,98 132,98 122,78" fill="var(--brand-yellow)" />
      </svg>
    );
  }
  if (kind === 'chart') {
    return (
      <svg width="132" height="100" viewBox="0 0 132 100" aria-hidden>
        <rect x="10" y="56" width="22" height="40" rx="3" fill="var(--brand-deep)" />
        <rect x="40" y="30" width="22" height="66" rx="3" fill="var(--accent)" />
        <rect x="70" y="44" width="22" height="52" rx="3" fill="var(--brand-light)" />
        <circle cx="112" cy="26" r="16" fill="var(--brand-yellow)" />
      </svg>
    );
  }
  if (kind === 'folders') {
    return (
      <svg width="132" height="100" viewBox="0 0 132 100" aria-hidden>
        <path d="M14 30h30l8 10h48v52H14z" fill="var(--brand-deep)" />
        <path d="M30 44h30l8 10h48v40H30z" fill="var(--accent)" />
        <circle cx="104" cy="22" r="14" fill="var(--brand-yellow)" />
      </svg>
    );
  }
  return (
    <svg width="160" height="104" viewBox="0 0 160 104" aria-hidden>
      <path d="M8 104V44h56v60H48V72a12 12 0 0 0-24 0v32z" fill="var(--accent)" />
      <rect x="62" y="36" width="46" height="16" rx="2" transform="rotate(24 62 36)" fill="var(--brand-light)" />
      <circle cx="94" cy="22" r="16" fill="var(--brand-yellow)" />
      <polygon points="66,104 106,104 86,62" fill="var(--brand-yellow)" />
      <path d="M112 104V46h14v14h14v14h14v30z" fill="var(--brand-deep)" />
    </svg>
  );
}

export function EmptyState({
  title,
  text,
  action,
  secondary,
  illustration = 'shapes',
  compact,
}: {
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
  secondary?: ReactNode;
  illustration?: IllustrationKind | null;
  compact?: boolean;
}) {
  return (
    <div className={compact ? `${styles.empty} ${styles.compact}` : styles.empty}>
      {illustration && <Illustration kind={illustration} />}
      <h3 className={styles.title}>{title}</h3>
      {text && <p className={styles.text}>{text}</p>}
      {action && <div className={styles.action}>{action}</div>}
      {secondary}
    </div>
  );
}

export function Spinner({ size = 20 }: { size?: number }) {
  return <span className={styles.spinner} style={{ width: size, height: size }} role="progressbar" />;
}

export function LoadingBlock() {
  return (
    <div className={styles.loading}>
      <Spinner />
    </div>
  );
}
