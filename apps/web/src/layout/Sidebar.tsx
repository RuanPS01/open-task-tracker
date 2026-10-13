// Barra lateral no desenho do Toggl Track: trilho estreito (marca, recolher, usuário)
// e coluna de navegação com seletor de workspace e seções Analisar, Planejar, Gerenciar.
import { formatClock, type Theme } from '@ott/shared';
import clsx from 'clsx';
import {
  Building2,
  ChartGantt,
  ChevronDown,
  Clock,
  Download,
  FileText,
  Folder,
  Keyboard,
  ListChecks,
  LogOut,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Plus,
  Search,
  Settings,
  Square,
  Sun,
  Tag,
  User,
  Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useProjectMap } from '../data/projects';
import { useLogout, useSwitchWorkspace, useUpdateProfile } from '../data/session';
import { useRunningTimer, useStopTimer } from '../data/timeEntries';
import { useCreateWorkspace } from '../data/workspace';
import { usePwa } from '../app/pwa';
import { useSession } from '../app/session';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { DataModeBadge } from '../components/DataModeNotice';
import { Checkbox, Field, Input } from '../components/ui/Field';
import { Menu } from '../components/ui/Menu';
import { Modal } from '../components/ui/Modal';
import { useT } from '../i18n';
import { useNow } from '../lib/hooks';
import { LogoMark } from './Logo';
import styles from './Sidebar.module.css';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

function useNavSections(): { title?: string; items: NavItem[] }[] {
  const t = useT();
  return [
    { items: [{ to: '/timer', label: t.nav.timer, icon: <Clock /> }] },
    { title: t.nav.analyze, items: [{ to: '/reports', label: t.nav.reports, icon: <FileText /> }] },
    {
      title: t.nav.plan,
      items: [
        { to: '/projects', label: t.nav.projects, icon: <Folder /> },
        { to: '/tasks', label: t.nav.tasks, icon: <ListChecks /> },
        { to: '/timeline', label: t.nav.timeline, icon: <ChartGantt /> },
      ],
    },
    {
      title: t.nav.manage,
      items: [
        { to: '/members', label: t.nav.members, icon: <Users /> },
        { to: '/clients', label: t.nav.clients, icon: <Building2 /> },
        { to: '/tags', label: t.nav.tags, icon: <Tag /> },
      ],
    },
  ];
}

function WorkspaceSwitcher() {
  const t = useT();
  const { workspace, workspaces } = useSession();
  const switchWorkspace = useSwitchWorkspace();
  const createWorkspace = useCreateWorkspace();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [demo, setDemo] = useState(false);

  return (
    <>
      <Menu
        width={240}
        trigger={({ ref, getProps }) => (
          <button ref={ref} type="button" className={styles.workspace} {...getProps()}>
            <span className={styles.workspaceName}>{workspace.name}</span>
            <ChevronDown size={14} />
          </button>
        )}
        items={[
          { heading: t.nav.workspaces },
          ...workspaces.map((w) => ({
            key: `ws-${w.id}`,
            label: w.name,
            checked: w.id === workspace.id,
            onSelect: () => {
              if (w.id !== workspace.id) switchWorkspace.mutate(w.id, { onSuccess: () => navigate('/timer') });
            },
          })),
          'separator',
          { key: 'new', label: t.nav.newWorkspace, icon: <Plus />, onSelect: () => setCreating(true) },
          { key: 'settings', label: t.nav.workspaceSettings, icon: <Settings />, onSelect: () => navigate('/settings/workspace') },
        ]}
      />
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t.nav.newWorkspace}
        width={400}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="primary"
              disabled={!name.trim()}
              loading={createWorkspace.isPending}
              onClick={() =>
                createWorkspace.mutate({ name: name.trim(), demo }, {
                  onSuccess: () => {
                    setCreating(false);
                    setName('');
                    setDemo(false);
                    navigate('/timer');
                  },
                })
              }
            >
              {t.common.create}
            </Button>
          </>
        }
      >
        <Field label={t.nav.newWorkspaceName}>
          {(id) => <Input id={id} value={name} onChange={(event) => setName(event.target.value)} autoFocus />}
        </Field>
        <Field hint={t.nav.demoWorkspaceHint}>
          {() => <Checkbox checked={demo} onChange={setDemo} label={t.nav.demoWorkspace} />}
        </Field>
      </Modal>
    </>
  );
}

/** Cronômetro rodando (fora da tela do cronômetro): na barra lateral e, no celular, acima da barra inferior. */
export function RunningTimerCard({ className }: { className?: string }) {
  const t = useT();
  const { data: running } = useRunningTimer();
  const stop = useStopTimer();
  const projects = useProjectMap();
  const now = useNow(1000);
  const location = useLocation();
  const navigate = useNavigate();
  if (!running || location.pathname === '/timer') return null;
  const project = running.projectId ? projects.get(running.projectId) : undefined;
  return (
    <div className={clsx(styles.running, className)} onClick={() => navigate('/timer')} role="link" tabIndex={0}>
      <div className={styles.runningText}>
        <span className={styles.runningDescription}>{running.description || t.timer.noDescription}</span>
        {project && (
          <span className={styles.runningProject} style={{ color: project.color }}>
            {project.name}
          </span>
        )}
        <span className={styles.runningClock}>{formatClock((now.getTime() - Date.parse(running.start)) / 1000)}</span>
      </div>
      <button
        type="button"
        className={styles.stop}
        aria-label={t.timer.stop}
        title={t.timer.stop}
        onClick={(event) => {
          event.stopPropagation();
          stop.mutate(running);
        }}
      >
        <Square size={12} fill="currentColor" />
      </button>
    </div>
  );
}

function UserMenu() {
  const t = useT();
  const { user } = useSession();
  const logout = useLogout();
  const updateProfile = useUpdateProfile();
  const navigate = useNavigate();
  const { install } = usePwa();
  const setTheme = (theme: Theme) => updateProfile.mutate({ preferences: { theme } });
  return (
    <Menu
      placement="right-end"
      width={230}
      trigger={({ ref, getProps }) => (
        <button ref={ref} type="button" className={styles.avatarButton} aria-label={user.name} {...getProps()}>
          <Avatar name={user.name} color={user.avatarColor} size={24} />
        </button>
      )}
      items={[
        { heading: user.email },
        { key: 'profile', label: t.nav.profile, icon: <User />, onSelect: () => navigate('/settings/profile') },
        ...(install ? [{ key: 'install', label: t.pwa.install, icon: <Download />, onSelect: () => void install() }] : []),
        'separator',
        { heading: t.nav.theme },
        { key: 'dark', label: t.nav.themeDark, icon: <Moon />, checked: user.preferences.theme === 'dark', onSelect: () => setTheme('dark') },
        { key: 'light', label: t.nav.themeLight, icon: <Sun />, checked: user.preferences.theme === 'light', onSelect: () => setTheme('light') },
        { key: 'system', label: t.nav.themeSystem, icon: <Monitor />, checked: user.preferences.theme === 'system', onSelect: () => setTheme('system') },
        'separator',
        { key: 'logout', label: t.nav.logout, icon: <LogOut />, onSelect: () => logout.mutate(undefined, { onSuccess: () => navigate('/login') }) },
      ]}
    />
  );
}

export function Sidebar({
  collapsed,
  onToggle,
  onSearch,
  onHelp,
  drawer = false,
}: {
  collapsed: boolean;
  /** Recolhe ou expande; na gaveta do celular, fecha. */
  onToggle: () => void;
  onSearch: () => void;
  onHelp: () => void;
  /** Gaveta do celular: sempre expandida e com botão de fechar. */
  drawer?: boolean;
}) {
  const t = useT();
  const sections = useNavSections();
  const navClass = ({ isActive }: { isActive: boolean }) => clsx(styles.link, isActive && styles.linkActive);
  const toggleLabel = drawer ? t.nav.closeMenu : collapsed ? t.nav.expand : t.nav.collapse;

  return (
    <aside className={clsx(styles.sidebar, collapsed && styles.collapsed, drawer && styles.drawer)}>
      <div className={styles.rail}>
        <NavLink to="/timer" className={styles.logo} aria-label="Open Task Tracker">
          <LogoMark size={26} />
          <span className={styles.logoText}>OTT</span>
        </NavLink>
        {collapsed && (
          <nav className={styles.railNav}>
            {sections.flatMap((section) => section.items).map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => clsx(styles.railLink, isActive && styles.linkActive)} title={item.label} aria-label={item.label}>
                {item.icon}
              </NavLink>
            ))}
          </nav>
        )}
        <button type="button" className={styles.railButton} onClick={onToggle} aria-label={toggleLabel} title={toggleLabel}>
          {drawer ? <X /> : collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </button>
        <div className={styles.railBottom}>
          <UserMenu />
          <button type="button" className={styles.railButton} onClick={onSearch} aria-label={t.nav.quickSearch} title={t.nav.quickSearch}>
            <Search />
          </button>
          <button type="button" className={styles.railButton} onClick={onHelp} aria-label={t.nav.shortcuts} title={t.nav.shortcuts}>
            <Keyboard />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className={styles.nav}>
          <WorkspaceSwitcher />
          <button type="button" className={styles.search} onClick={onSearch} title="Ctrl K">
            <Search size={15} />
            <span>{t.nav.quickSearch}</span>
          </button>
          <RunningTimerCard />
          <nav className={styles.sections}>
            {sections.map((section, index) => (
              <div key={section.title ?? index}>
                {section.title && <div className={styles.sectionTitle}>{section.title}</div>}
                {section.items.map((item) => (
                  <NavLink key={item.to} to={item.to} className={navClass}>
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className={styles.navFooter}>
            <NavLink to="/settings/workspace" className={navClass}>
              <Settings />
              <span>{t.nav.settings}</span>
            </NavLink>
            <div className={styles.dataMode}>
              <DataModeBadge />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

