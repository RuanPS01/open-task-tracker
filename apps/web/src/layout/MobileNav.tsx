// Barra inferior do celular: destinos principais e o botão que abre a gaveta com a
// barra lateral completa. Acima dela, o cronômetro rodando (fora da tela do cronômetro).
import clsx from 'clsx';
import { Clock, FileText, Folder, ListChecks, Menu } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useT } from '../i18n';
import styles from './MobileNav.module.css';
import { RunningTimerCard } from './Sidebar';

export function MobileNav({ onMenu }: { onMenu: () => void }) {
  const t = useT();
  const items = [
    { to: '/timer', label: t.nav.timer, icon: <Clock /> },
    { to: '/tasks', label: t.nav.tasks, icon: <ListChecks /> },
    { to: '/projects', label: t.nav.projects, icon: <Folder /> },
    { to: '/reports', label: t.nav.reports, icon: <FileText /> },
  ];
  return (
    <div className={styles.bottom}>
      <RunningTimerCard className={styles.running} />
      <nav className={styles.bar} aria-label={t.nav.mainNav}>
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => clsx(styles.item, isActive && styles.active)}>
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button type="button" className={styles.item} onClick={onMenu}>
          <Menu />
          <span>{t.nav.menu}</span>
        </button>
      </nav>
    </div>
  );
}
