import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatClock } from '@ott/shared';
import { FallbackBanner } from '../components/DataModeNotice';
import { useRunningTimer, useStartTimer, useStopTimer } from '../data/timeEntries';
import { QuickSearch } from '../features/search/QuickSearch';
import { ShortcutsDialog } from '../features/search/ShortcutsDialog';
import { TaskPanelProvider, useTaskPanel } from '../features/tasks/TaskPanelContext';
import { useT } from '../i18n';
import { useHotkey, useNow, useStoredState } from '../lib/hooks';
import styles from './AppShell.module.css';
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
  return (
    <TaskPanelProvider>
      <div className={styles.shell}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          onSearch={() => setSearchOpen(true)}
          onHelp={() => setHelpOpen(true)}
        />
        <main className={styles.main}>
          <FallbackBanner />
          {children}
        </main>
      </div>
      <RunningTitle />
      <GlobalShortcuts onSearch={() => setSearchOpen(true)} onHelp={() => setHelpOpen(true)} />
      <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </TaskPanelProvider>
  );
}
