// Página do projeto com abas: Visão geral (painel), Cronograma (Gantt) e Tarefas.
import { addDays, computeCriticalPath, toIsoDate, type Project, type Task } from '@ott/shared';
import { ArrowLeft, LayoutList, Pencil, Plus, SquareKanban } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, NavLink, Navigate, useParams } from 'react-router-dom';
import { useProjects } from '../../data/projects';
import { useSummaryReport } from '../../data/reports';
import { useDependencies, useTasks } from '../../data/tasks';
import { useClients, useMembers } from '../../data/workspace';
import { usePreferences } from '../../app/session';
import { HorizontalBars, StackedMeter, StatTile } from '../../components/charts/Charts';
import { StatusIcon } from '../../components/pickers/TaskIcons';
import { Avatar } from '../../components/ui/Avatar';
import { Button, IconButton } from '../../components/ui/Button';
import { EmptyState, LoadingBlock } from '../../components/ui/EmptyState';
import { ColorDot } from '../../components/ui/ProjectLabel';
import { Segmented, Toolbar, ToolbarSpacer } from '../../components/ui/Toolbar';
import { useT } from '../../i18n';
import { useWorkCalendar } from '../../lib/calendar';
import { useFormat } from '../../lib/format';
import { useStoredState } from '../../lib/hooks';
import { ProjectGantt } from '../gantt/ProjectGantt';
import { useTaskPanel } from '../tasks/TaskPanelContext';
import { GroupSortControls, TaskFiltersButton, TaskListView, useTaskRowContext } from '../tasks/TasksPage';
import { TaskBoard } from '../tasks/TaskBoard';
import { applyFilters, type GroupBy, type SortBy, type TaskFilters } from '../tasks/taskGrouping';
import { ProjectDialog } from './ProjectDialog';
import styles from './ProjectPage.module.css';

type Tab = 'overview' | 'gantt' | 'tasks';

export function ProjectPage() {
  const t = useT();
  const params = useParams();
  const projectId = params.projectId ?? '';
  const tab = (params.tab ?? 'overview') as Tab;
  const { data: projects, isLoading } = useProjects();
  const { data: clients = [] } = useClients();
  const [editing, setEditing] = useState(false);
  const project = projects?.find((item) => item.id === projectId);

  if (!['overview', 'gantt', 'tasks'].includes(tab)) return <Navigate to={`/projects/${projectId}`} replace />;
  if (isLoading) return <LoadingBlock />;
  if (!project) {
    return <EmptyState illustration="folders" title={t.projects.notFound} action={<Link to="/projects">{t.common.back}</Link>} />;
  }
  const client = project.clientId ? clients.find((item) => item.id === project.clientId) : undefined;

  return (
    <>
      <header className={styles.header}>
        <Link to="/projects" className={styles.back} aria-label={t.common.back} title={t.common.back}>
          <ArrowLeft size={18} />
        </Link>
        <ColorDot color={project.color} size={12} />
        <h1 className={styles.title}>{project.name}</h1>
        {client && <span className={styles.client}>{client.name}</span>}
        <IconButton icon={<Pencil />} label={t.projects.edit} size="sm" onClick={() => setEditing(true)} />
        <nav className={styles.tabs}>
          <NavLink end to={`/projects/${project.id}`} className={({ isActive }) => (isActive ? styles.tabActive : styles.tab)}>
            {t.projects.overview}
          </NavLink>
          <NavLink to={`/projects/${project.id}/gantt`} className={({ isActive }) => (isActive ? styles.tabActive : styles.tab)}>
            {t.projects.gantt}
          </NavLink>
          <NavLink to={`/projects/${project.id}/tasks`} className={({ isActive }) => (isActive ? styles.tabActive : styles.tab)}>
            {t.projects.tasksTab}
          </NavLink>
        </nav>
      </header>
      <div className={styles.body}>
        {tab === 'overview' && <ProjectOverview project={project} />}
        {tab === 'gantt' && <ProjectGantt project={project} />}
        {tab === 'tasks' && <ProjectTasks project={project} />}
      </div>
      {editing && <ProjectDialog project={project} onClose={() => setEditing(false)} />}
    </>
  );
}

function ProjectTasks({ project }: { project: Project }) {
  const t = useT();
  const panel = useTaskPanel();
  const { data: allTasks = [] } = useTasks();
  const tasks = useMemo(() => allTasks.filter((task) => task.projectId === project.id), [allTasks, project.id]);
  const context = useTaskRowContext(allTasks);
  const [view, setView] = useStoredState<'list' | 'board'>('ott.projectTasksView', 'list');
  const [groupBy, setGroupBy] = useStoredState<GroupBy>('ott.projectTasksGroup', 'status');
  const [sortBy, setSortBy] = useStoredState<SortBy>('ott.projectTasksSort', 'dueDate');
  const [descending, setDescending] = useStoredState('ott.projectTasksDesc', false);
  const [filters, setFilters] = useState<TaskFilters>({ statuses: [], projectIds: [], priorities: [] });
  const visible = applyFilters(tasks, filters, { assigneeId: null, showCompleted: true, search: '' });

  return (
    <>
      <Toolbar>
        <TaskFiltersButton filters={filters} onChange={setFilters} showProjects={false} />
        {view === 'list' && (
          <GroupSortControls
            groupBy={groupBy}
            setGroupBy={setGroupBy}
            sortBy={sortBy}
            setSortBy={setSortBy}
            descending={descending}
            setDescending={setDescending}
            allowProjectGroup={false}
          />
        )}
        <ToolbarSpacer />
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: '', icon: <LayoutList />, title: t.tasks.list },
            { value: 'board', label: '', icon: <SquareKanban />, title: t.tasks.board },
          ]}
        />
        <Button size="sm" variant="primary" icon={<Plus />} onClick={() => panel.openNew({ projectId: project.id })}>
          {t.tasks.add}
        </Button>
      </Toolbar>
      <div className={styles.scroll}>
        {tasks.length === 0 ? (
          <EmptyState
            title={t.tasks.emptyTitle}
            text={t.tasks.emptyText}
            action={
              <Button variant="primary" icon={<Plus />} onClick={() => panel.openNew({ projectId: project.id })}>
                {t.tasks.createFirst}
              </Button>
            }
          />
        ) : view === 'board' ? (
          <TaskBoard tasks={visible} context={context} defaults={{ projectId: project.id }} />
        ) : (
          <TaskListView
            tasks={visible}
            groupBy={groupBy}
            sortBy={sortBy}
            descending={descending}
            context={context}
            hideProject
            quickAddDefaults={{ projectId: project.id }}
          />
        )}
      </div>
    </>
  );
}

function ProjectOverview({ project }: { project: Project }) {
  const t = useT();
  const format = useFormat();
  const { calendar } = useWorkCalendar();
  const { timezone } = usePreferences();
  const panel = useTaskPanel();
  const { data: allTasks = [] } = useTasks();
  const { data: allDependencies = [] } = useDependencies();
  const { data: members = [] } = useMembers();
  const today = toIsoDate(new Date());
  const days = 90;
  const { data: report } = useSummaryReport({ start: addDays(today, -(days - 1)), end: today, tz: timezone, projectIds: [project.id] });

  const tasks = useMemo(() => allTasks.filter((task) => task.projectId === project.id), [allTasks, project.id]);
  const plan = useMemo(() => {
    const ids = new Set(tasks.map((task) => task.id));
    const dependencies = allDependencies.filter((dep) => ids.has(dep.predecessorId) && ids.has(dep.successorId));
    return computeCriticalPath(tasks, dependencies, calendar);
  }, [tasks, allDependencies, calendar]);

  // Tarefas-mãe ficam de fora das contagens: o trabalho está nas filhas.
  const parentIds = new Set(tasks.map((task) => task.parentId));
  const leaves = tasks.filter((task) => !parentIds.has(task.id));
  const counts = { todo: 0, in_progress: 0, done: 0 };
  for (const task of leaves) counts[task.status] += 1;
  const remaining = project.estimateSeconds ? project.estimateSeconds - project.trackedSeconds : null;
  const late = Boolean(project.endDate && plan.projectEnd && plan.projectEnd > project.endDate);
  const memberMap = new Map(members.map((member) => [member.userId, member]));

  const byTask = tasks
    .filter((task) => task.trackedSeconds > 0)
    .sort((a, b) => b.trackedSeconds - a.trackedSeconds)
    .slice(0, 8);
  const upcoming = leaves
    .filter((task): task is Task & { dueDate: string } => task.status !== 'done' && task.dueDate !== null && task.dueDate <= addDays(today, 21))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 8);

  return (
    <div className={styles.overview}>
      <div className={styles.tiles}>
        <StatTile label={t.projects.trackedTotal} value={format.hours(project.trackedSeconds)} />
        <StatTile
          label={t.projects.estimate.replace(/ \(.+\)$/, '')}
          value={project.estimateSeconds ? format.hours(project.estimateSeconds) : '-'}
          detail={project.estimateSeconds ? format.percent((project.trackedSeconds / project.estimateSeconds) * 100) : t.projects.noEstimate}
        />
        <StatTile
          label={t.projects.remaining}
          value={remaining === null ? '-' : format.hours(remaining)}
          tone={remaining !== null && remaining < 0 ? 'danger' : undefined}
          detail={remaining !== null && remaining < 0 ? t.projects.overEstimate : undefined}
        />
        <StatTile label={t.tasks.title} value={`${counts.done}/${leaves.length}`} detail={t.projects.tasksDone(counts.done, leaves.length)} />
        <StatTile
          label={t.gantt.projectEnd}
          value={plan.projectEnd ? format.dayMonth(plan.projectEnd) : '-'}
          tone={late ? 'danger' : undefined}
          detail={project.endDate ? `${t.projects.endDate}: ${format.dayMonth(project.endDate)}` : undefined}
        />
      </div>

      <div className={styles.cards}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t.projects.taskStatus}</h2>
          <StackedMeter
            formatValue={(value) => String(value)}
            parts={[
              { key: 'todo', label: t.tasks.statusLabels.todo, value: counts.todo, color: 'var(--status-todo)' },
              { key: 'in_progress', label: t.tasks.statusLabels.in_progress, value: counts.in_progress, color: 'var(--status-progress)' },
              { key: 'done', label: t.tasks.statusLabels.done, value: counts.done, color: 'var(--status-done)' },
            ]}
          />
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            {t.projects.byMember} <span className={styles.cardHint}>{t.projects.lastDays(days)}</span>
          </h2>
          {report && report.byUser.length > 0 ? (
            <HorizontalBars
              formatValue={format.hours}
              data={report.byUser.map((row) => {
                const member = memberMap.get(row.userId);
                return {
                  key: String(row.userId),
                  label: member?.name ?? '?',
                  value: row.seconds,
                  marker: member ? <Avatar name={member.name} color={member.avatarColor} size={20} /> : undefined,
                };
              })}
            />
          ) : (
            <p className={styles.empty}>{t.projects.noData}</p>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t.projects.byTask}</h2>
          {byTask.length > 0 ? (
            <HorizontalBars
              formatValue={format.hours}
              data={byTask.map((task) => ({ key: String(task.id), label: task.name, value: task.trackedSeconds }))}
            />
          ) : (
            <p className={styles.empty}>{t.projects.noData}</p>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t.projects.upcoming}</h2>
          {upcoming.length > 0 ? (
            <ul className={styles.upcoming}>
              {upcoming.map((task) => (
                <li key={task.id}>
                  <button type="button" onClick={() => panel.openTask(task.id)}>
                    <StatusIcon status={task.status} />
                    <span className={styles.upcomingName}>{task.name}</span>
                    <span className={task.dueDate < today ? styles.overdue : styles.upcomingDate}>
                      {task.dueDate === today ? t.common.today : format.dayMonth(task.dueDate)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>{t.projects.noData}</p>
          )}
        </section>
      </div>
    </div>
  );
}
