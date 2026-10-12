import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

/** Cabeçalho das páginas: "Tarefas · Lista" à esquerda e ações à direita. */
export function PageHeader({
  title,
  subtitle,
  actions,
  leading,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      {leading}
      <h1 className={styles.title}>
        {title}
        {subtitle && <span className={styles.subtitle}> &middot; {subtitle}</span>}
      </h1>
      <div className={styles.actions}>{actions}</div>
    </header>
  );
}

export function PageBody({ children, padded = false }: { children: ReactNode; padded?: boolean }) {
  return <div className={padded ? `${styles.body} ${styles.padded}` : styles.body}>{children}</div>;
}
