import clsx from 'clsx';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatClock } from '@ott/shared';
import { FallbackBanner } from '../components/DataModeNotice';
import { useRunningTimer, useStartTimer, useStopTimer } from '../data/timeEntries';
import { QuickSearch } from '../features/search/QuickSearch';
import { ShortcutsDialog } from '../features/search/ShortcutsDialog';
import { TaskPanelProvider, useTaskPanel } from '../features/tasks/TaskPanelContext';
import { useT } from '../i18n';
import { useHotkey, useIsMobile, useNow, useStoredState } from '../lib/hooks';
import styles from './AppShell.module.css';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';

function RunningTitle() {
  const t = useT();
  const { data: running } = useRunningTimer();
  const now = useNow(1000);
  useEffect(() => {
    if (!running) {
      document.title = 'Open Task Tracker';
      return;
    }
    const seconds = (now.getTime() - Date.parse(running.start)) / 1000;
    document.title = `${formatClock(seconds)} ${running.description || t.timer.noDescription}`;
  }, [running, now, t]);
  useEffect(() => () => void (document.title = 'Open Task Tracker'), []);
  return null;
}

function GlobalShortcuts({ onSearch, onHelp }: { onSearch: () => void; onHelp: () => void }) {
  const { data: running } = useRunningTimer();
  const start = useStartTimer();
  const stop = useStopTimer();
  const panel = useTaskPanel();
  const navigate = useNavigate();
  useHotkey('s', () => {
    if (running) stop.mutate(running);
    else start.mutate({});
  });
  useHotkey('n', () => panel.openNew({}));
  useHotkey('mod+k', (event) => {
    event.preventDefault();
    onSearch();
  });
  useHotkey('?', onHelp);
  useHotkey('t', () => navigate('/timer'));
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useStoredState('ott.sidebarCollapsed', false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const mobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  // A gaveta fecha ao navegar e quando a tela deixa de ser de celular.
  useEffect(() => setDrawerOpen(false), [location.pathname, mobile]);
  const openSearch = () => {
    setDrawerOpen(false);
    setSearchOpen(true);
  };
  return (
    <TaskPanelProvider>
      <div className={clsx(styles.shell, mobile && styles.mobile)}>
        {!mobile && (
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} onSearch={openSearch} onHelp={() => setHelpOpen(true)} />
        )}
        {mobile && drawerOpen && (
          <div className={styles.drawerLayer}>
            <div className={styles.scrim} onClick={() => setDrawerOpen(false)} aria-hidden />
            <div className={styles.drawer}>
              <Sidebar drawer collapsed={false} onToggle={() => setDrawerOpen(false)} onSearch={openSearch} onHelp={() => setHelpOpen(true)} />
            </div>
          </div>
        )}
        <main className={styles.main}>
          <FallbackBanner />
          {children}
        </main>
        {mobile && <MobileNav onMenu={() => setDrawerOpen(true)} />}
      </div>
      <RunningTitle />
      <GlobalShortcuts onSearch={() => setSearchOpen(true)} onHelp={() => setHelpOpen(true)} />
      <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </TaskPanelProvider>
  );
}
