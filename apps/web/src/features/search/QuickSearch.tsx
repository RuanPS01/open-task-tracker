// Busca rápida (Ctrl K): páginas, projetos e tarefas num lugar só, navegável por teclado.
import { ChartGantt, Clock, FileText, Folder, ListChecks, Settings, Tag, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../data/projects';
import { useTasks } from '../../data/tasks';
import { StatusIcon } from '../../components/pickers/TaskIcons';
import { Modal } from '../../components/ui/Modal';
import { ColorDot } from '../../components/ui/ProjectLabel';
import { useT } from '../../i18n';
import { useTaskPanel } from '../tasks/TaskPanelContext';
import styles from './QuickSearch.module.css';

interface Result {
  key: string;
  group: string;
  label: string;
  icon: ReactNode;
  run: () => void;
}

export function QuickSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const panel = useTaskPanel();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (text: string) => !q || text.toLowerCase().includes(q);
    const pages: Result[] = [
      { key: 'p-timer', group: t.search.pages, label: t.nav.timer, icon: <Clock />, run: () => navigate('/timer') },
      { key: 'p-reports', group: t.search.pages, label: t.nav.reports, icon: <FileText />, run: () => navigate('/reports') },
      { key: 'p-projects', group: t.search.pages, label: t.nav.projects, icon: <Folder />, run: () => navigate('/projects') },
      { key: 'p-tasks', group: t.search.pages, label: t.nav.tasks, icon: <ListChecks />, run: () => navigate('/tasks') },
      { key: 'p-timeline', group: t.search.pages, label: t.nav.timeline, icon: <ChartGantt />, run: () => navigate('/timeline') },
      { key: 'p-members', group: t.search.pages, label: t.nav.members, icon: <Users />, run: () => navigate('/members') },
      { key: 'p-tags', group: t.search.pages, label: t.nav.tags, icon: <Tag />, run: () => navigate('/tags') },
      { key: 'p-settings', group: t.search.pages, label: t.nav.workspaceSettings, icon: <Settings />, run: () => navigate('/settings/workspace') },
    ].filter((item) => match(item.label));
    const projectResults: Result[] = projects
      .filter((project) => !project.archived && match(project.name))
      .slice(0, 8)
      .map((project) => ({
        key: `pr-${project.id}`,
        group: t.search.projects,
        label: project.name,
        icon: <ColorDot color={project.color} size={10} />,
        run: () => navigate(`/projects/${project.id}/gantt`),
      }));
    const taskResults: Result[] = q
      ? tasks
          .filter((task) => match(task.name))
          .slice(0, 12)
          .map((task) => ({
            key: `t-${task.id}`,
            group: t.search.tasks,
            label: task.name,
            icon: <StatusIcon status={task.status} />,
            run: () => panel.openTask(task.id),
          }))
      : [];
    return [...pages, ...projectResults, ...taskResults];
  }, [query, projects, tasks, t, navigate, panel]);

  const run = (result: Result | undefined) => {
    if (!result) return;
    onClose();
    result.run();
  };

  let lastGroup = '';
  return (
    <Modal open={open} onClose={onClose} width={560} className={styles.modal}>
      <input
        className={styles.input}
        placeholder={t.search.placeholder}
        value={query}
        autoFocus
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((index) => Math.min(results.length - 1, index + 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((index) => Math.max(0, index - 1));
          } else if (event.key === 'Enter') {
            run(results[active]);
          }
        }}
      />
      <div className={styles.results} role="listbox">
        {results.map((result, index) => {
          const heading = result.group !== lastGroup ? result.group : null;
          lastGroup = result.group;
          return (
            <div key={result.key}>
              {heading && <div className={styles.group}>{heading}</div>}
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                className={styles.result}
                data-active={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => run(result)}
              >
                <span className={styles.icon}>{result.icon}</span>
                <span className={styles.label}>{result.label}</span>
              </button>
            </div>
          );
        })}
        {results.length === 0 && <div className={styles.empty}>{t.common.noResults}</div>}
      </div>
      <div className={styles.hint}>{t.search.hint}</div>
    </Modal>
  );
}
