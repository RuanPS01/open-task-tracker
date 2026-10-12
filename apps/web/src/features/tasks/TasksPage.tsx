// Tela Tarefas (Toggl "Tasks"): Lista agrupada ou Quadro, com "Minhas tarefas",
// filtros, agrupar por, ordenar por, busca e mostrar concluídas.
import {
  NO_ID,
  PRIORITIES,
  PRIORITY_KEYS,
  TASK_STATUSES,
  toIsoDate,
  type CreateTaskInput,
  type Id,
  type Task,
} from '@ott/shared';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Filter,
  LayoutList,
  ListTree,
  Plus,
  Search,
  SquareKanban,
  User,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useProjectMap } from '../../data/projects';
import { useCreateTask, useTasks } from '../../data/tasks';
import { useMembers } from '../../data/workspace';
import { useCurrentUser, usePreferences } from '../../app/session';
import { PriorityIcon, StatusIcon } from '../../components/pickers/TaskIcons';
import { Button, IconButton } from '../../components/ui/Button';
import { EmptyState, LoadingBlock } from '../../components/ui/EmptyState';
import { Checkbox } from '../../components/ui/Field';
import { Menu } from '../../components/ui/Menu';
import { Popover } from '../../components/ui/Popover';
import { ColorDot } from '../../components/ui/ProjectLabel';
import { ChipButton, Segmented, Toolbar, ToolbarDivider, ToolbarSpacer } from '../../components/ui/Toolbar';
import { useT, type Messages } from '../../i18n';
import { PageHeader } from '../../layout/PageHeader';
import { useStoredState } from '../../lib/hooks';
import { TaskBoard } from './TaskBoard';
import { useTaskPanel } from './TaskPanelContext';
import { TaskRow, type TaskRowContext } from './TaskRow';
import { applyFilters, groupTasks, sortTasks, type GroupBy, type SortBy, type TaskFilters } from './taskGrouping';
import styles from './TasksPage.module.css';

export function useTaskRowContext(tasks: Task[]): TaskRowContext {
  const projects = useProjectMap();
  const { data: members = [] } = useMembers();
  return useMemo(() => {
    const childCount = new Map<Id, { done: number; total: number }>();
    for (const task of tasks) {
      if (task.parentId === null) continue;
      const current = childCount.get(task.parentId) ?? { done: 0, total: 0 };
      current.total += 1;
      if (task.status === 'done') current.done += 1;
      childCount.set(task.parentId, current);
    }
    return {
      projects,
      members: new Map(members.map((member) => [member.userId, member])),
      parents: new Map(tasks.map((task) => [task.id, task])),
      childCount,
    };
  }, [tasks, projects, members]);
}

function groupLabel(t: Messages, groupBy: GroupBy, key: string, context: TaskRowContext): { label: string; icon?: React.ReactNode } {
  switch (groupBy) {
    case 'date':
      return { label: t.tasks[key as 'overdue'] };
    case 'status':
      return { label: t.tasks.statusLabels[key as 'todo'], icon: <StatusIcon status={key as 'todo'} /> };
    case 'priority':
      return {
        label: t.tasks.priorityLabels[PRIORITY_KEYS[Number(key) as 0]],
        icon: <PriorityIcon priority={Number(key) as 0} />,
      };
    case 'project': {
      const project = context.projects.get(key);
      return project ? { label: project.name, icon: <ColorDot color={project.color} /> } : { label: t.tasks.noProject };
    }
    case 'assignee':
      return { label: context.members.get(key)?.name ?? t.tasks.unassigned };
    default:
      return { label: t.tasks.allTasks };
  }
}

/** Lista agrupada reaproveitada na tela Tarefas e na aba Tarefas do projeto. */
export function TaskListView({
  tasks,
  groupBy,
  sortBy,
  descending,
  context,
  hideProject,
  quickAddDefaults,
}: {
  tasks: Task[];
  groupBy: GroupBy;
  sortBy: SortBy;
  descending: boolean;
  context: TaskRowContext;
  hideProject?: boolean;
  quickAddDefaults: Partial<CreateTaskInput>;
}) {
  const t = useT();
  const panel = useTaskPanel();
  const { weekStart } = usePreferences();
  const createTask = useCreateTask();
  const [quickName, setQuickName] = useState('');
  const groups = groupTasks(sortTasks(tasks, sortBy, descending), groupBy, toIsoDate(new Date()), weekStart);

  const quickAdd = () => {
    const name = quickName.trim();
    if (!name) return;
    createTask.mutate({ ...quickAddDefaults, name });
    setQuickName('');
  };

  return (
    <div className={styles.list}>
      <div className={styles.quickAdd}>
        <Plus size={16} />
        <input
          value={quickName}
          onChange={(event) => setQuickName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && quickAdd()}
          placeholder={t.tasks.quickAdd}
          aria-label={t.tasks.quickAdd}
        />
      </div>
      {groups.map((group) => {
        const { label, icon } = groupLabel(t, groupBy, group.key, context);
        return (
          <section key={group.key} className={styles.group}>
            {groupBy !== 'none' && (
              <header className={styles.groupHeader} data-tone={group.key === 'overdue' ? 'danger' : undefined}>
                {icon}
                <span>{label}</span>
                <span className={styles.groupCount}>{group.tasks.length}</span>
              </header>
            )}
            {group.tasks.map((task) => (
              <TaskRow key={`${group.key}-${task.id}`} task={task} context={context} onOpen={() => panel.openTask(task.id)} hideProject={hideProject} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

export function TaskFiltersButton({
  filters,
  onChange,
  showProjects = true,
}: {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  showProjects?: boolean;
}) {
  const t = useT();
  const projects = useProjectMap();
  const count = filters.statuses.length + filters.projectIds.length + filters.priorities.length;
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  return (
    <Popover
      width={280}
      trigger={({ ref, getProps }) => <ChipButton ref={ref} icon={<Filter />} label={t.common.filters} count={count} active={count > 0} {...getProps()} />}
    >
      <div className={styles.filters}>
        <div className={styles.filterTitle}>{t.tasks.filterStatus}</div>
        {TASK_STATUSES.map((status) => (
          <Checkbox
            key={status}
            checked={filters.statuses.includes(status)}
            onChange={() => onChange({ ...filters, statuses: toggle(filters.statuses, status) })}
            label={
              <span className={styles.filterOption}>
                <StatusIcon status={status} /> {t.tasks.statusLabels[status]}
              </span>
            }
          />
        ))}
        <div className={styles.filterTitle}>{t.tasks.filterPriority}</div>
        {[...PRIORITIES].reverse().map((priority) => (
          <Checkbox
            key={priority}
            checked={filters.priorities.includes(priority)}
            onChange={() => onChange({ ...filters, priorities: toggle(filters.priorities, priority) })}
            label={
              <span className={styles.filterOption}>
                <PriorityIcon priority={priority} /> {t.tasks.priorityLabels[PRIORITY_KEYS[priority]]}
              </span>
            }
          />
        ))}
        {showProjects && (
          <>
            <div className={styles.filterTitle}>{t.tasks.filterProject}</div>
            <Checkbox
              checked={filters.projectIds.includes(NO_ID)}
              onChange={() => onChange({ ...filters, projectIds: toggle(filters.projectIds, NO_ID) })}
              label={t.tasks.noProject}
            />
            {[...projects.values()]
              .filter((project) => !project.archived)
              .map((project) => (
                <Checkbox
                  key={project.id}
                  checked={filters.projectIds.includes(project.id)}
                  onChange={() => onChange({ ...filters, projectIds: toggle(filters.projectIds, project.id) })}
                  label={
                    <span className={styles.filterOption}>
                      <ColorDot color={project.color} /> {project.name}
                    </span>
                  }
                />
              ))}
          </>
        )}
        {count > 0 && (
          <Button size="sm" variant="ghost" onClick={() => onChange({ statuses: [], projectIds: [], priorities: [] })}>
            {t.tasks.clearFilters}
          </Button>
        )}
      </div>
    </Popover>
  );
}

export function GroupSortControls({
  groupBy,
  setGroupBy,
  sortBy,
  setSortBy,
  descending,
  setDescending,
  allowProjectGroup = true,
}: {
  groupBy: GroupBy;
  setGroupBy: (value: GroupBy) => void;
  sortBy: SortBy;
  setSortBy: (value: SortBy) => void;
  descending: boolean;
  setDescending: (value: boolean) => void;
  allowProjectGroup?: boolean;
}) {
  const t = useT();
  const groupLabels: Record<GroupBy, string> = {
    date: t.tasks.groupDate,
    project: t.tasks.groupProject,
    status: t.tasks.groupStatus,
    priority: t.tasks.groupPriority,
    assignee: t.tasks.groupAssignee,
    none: t.tasks.groupNone,
  };
  const sortLabels: Record<SortBy, string> = {
    priority: t.tasks.sortPriority,
    dueDate: t.tasks.sortDueDate,
    name: t.tasks.sortName,
    created: t.tasks.sortCreated,
  };
  const groupOptions = (Object.keys(groupLabels) as GroupBy[]).filter((key) => allowProjectGroup || key !== 'project');
  return (
    <>
      <Menu
        trigger={({ ref, getProps }) => <ChipButton ref={ref} icon={<ListTree />} label={`${t.common.groupBy}:`} value={groupLabels[groupBy]} {...getProps()} />}
        items={groupOptions.map((key) => ({ key, label: groupLabels[key], checked: key === groupBy, onSelect: () => setGroupBy(key) }))}
      />
      <Menu
        trigger={({ ref, getProps }) => (
          <ChipButton
            ref={ref}
            icon={<ArrowUpDown />}
            label={`${t.common.sortBy}:`}
            value={sortLabels[sortBy]}
            trailing={descending ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
            {...getProps()}
          />
        )}
        items={[
          ...(Object.keys(sortLabels) as SortBy[]).map((key) => ({
            key,
            label: sortLabels[key],
            checked: key === sortBy,
            onSelect: () => (key === sortBy ? setDescending(!descending) : setSortBy(key)),
          })),
          'separator' as const,
          { key: 'dir', label: descending ? <ArrowDown size={14} /> : <ArrowUp size={14} />, onSelect: () => setDescending(!descending) },
        ]}
      />
    </>
  );
}

export function TasksPage() {
  const t = useT();
  const user = useCurrentUser();
  const panel = useTaskPanel();
  const { data: tasks = [], isLoading } = useTasks();
  const { data: members = [] } = useMembers();
  const [view, setView] = useStoredState<'list' | 'board'>('ott.tasksView', 'list');
  const [assignee, setAssignee] = useStoredState<Id | 'all' | 'me'>('ott.tasksAssignee', 'me');
  const [groupBy, setGroupBy] = useStoredState<GroupBy>('ott.tasksGroup', 'date');
  const [sortBy, setSortBy] = useStoredState<SortBy>('ott.tasksSort', 'priority');
  const [descending, setDescending] = useStoredState('ott.tasksDesc', true);
  const [showCompleted, setShowCompleted] = useStoredState('ott.tasksShowDone', false);
  const [filters, setFilters] = useState<TaskFilters>({ statuses: [], projectIds: [], priorities: [] });
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const context = useTaskRowContext(tasks);

  const assigneeId = assignee === 'all' ? null : assignee === 'me' ? user.id : assignee;
  const visible = applyFilters(tasks, filters, {
    assigneeId,
    showCompleted: showCompleted || view === 'board',
    search,
  });
  const assigneeLabel =
    assignee === 'me' ? t.tasks.myTasks : assignee === 'all' ? t.tasks.allTasks : (members.find((m) => m.userId === assignee)?.name ?? t.tasks.allTasks);

  return (
    <>
      <PageHeader
        title={t.tasks.title}
        subtitle={view === 'list' ? t.tasks.list : t.tasks.board}
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => panel.openNew(assigneeId ? { assigneeIds: [assigneeId] } : {})}>
            {t.tasks.add}
          </Button>
        }
      />
      <Toolbar>
        <Menu
          trigger={({ ref, getProps }) => (
            <ChipButton ref={ref} icon={<User />} label={assigneeLabel} trailing={<ChevronDown size={14} />} {...getProps()} />
          )}
          items={[
            { key: 'me', label: t.tasks.myTasks, checked: assignee === 'me', onSelect: () => setAssignee('me') },
            { key: 'all', label: t.tasks.allTasks, checked: assignee === 'all', onSelect: () => setAssignee('all') },
            'separator',
            ...members
              .filter((member) => member.active && member.userId !== user.id)
              .map((member) => ({
                key: `m${member.userId}`,
                label: member.name,
                checked: assignee === member.userId,
                onSelect: () => setAssignee(member.userId),
              })),
          ]}
        />
        <ToolbarDivider />
        <TaskFiltersButton filters={filters} onChange={setFilters} />
        {view === 'list' && (
          <GroupSortControls
            groupBy={groupBy}
            setGroupBy={setGroupBy}
            sortBy={sortBy}
            setSortBy={setSortBy}
            descending={descending}
            setDescending={setDescending}
          />
        )}
        <ToolbarSpacer />
        {searchOpen && (
          <input
            className={styles.search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.tasks.search}
            autoFocus
            onBlur={() => !search && setSearchOpen(false)}
          />
        )}
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: '', icon: <LayoutList />, title: t.tasks.list },
            { value: 'board', label: '', icon: <SquareKanban />, title: t.tasks.board },
          ]}
        />
        <IconButton icon={<Search />} label={t.tasks.search} active={searchOpen} onClick={() => setSearchOpen(!searchOpen)} />
        {view === 'list' && (
          <IconButton
            icon={<Archive />}
            label={showCompleted ? t.tasks.hideCompleted : t.tasks.showCompleted}
            active={showCompleted}
            onClick={() => setShowCompleted(!showCompleted)}
          />
        )}
      </Toolbar>
      <div className={styles.body}>
        {isLoading ? (
          <LoadingBlock />
        ) : tasks.length === 0 ? (
          <EmptyState
            title={t.tasks.emptyTitle}
            text={t.tasks.emptyText}
            action={
              <Button variant="primary" icon={<Plus />} onClick={() => panel.openNew({})}>
                {t.tasks.createFirst}
              </Button>
            }
          />
        ) : view === 'board' ? (
          <TaskBoard tasks={visible} context={context} />
        ) : visible.length === 0 ? (
          <EmptyState compact title={t.tasks.emptyFiltered} illustration="shapes" />
        ) : (
          <TaskListView
            tasks={visible}
            groupBy={groupBy}
            sortBy={sortBy}
            descending={descending}
            context={context}
            quickAddDefaults={assigneeId ? { assigneeIds: [assigneeId] } : {}}
          />
        )}
      </div>
    </>
  );
}
