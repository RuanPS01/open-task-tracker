// Aba Cronograma do projeto: barra de ferramentas do Gantt e ligação com a camada de dados.
import { computeCriticalPath, type Id, type Project, type TaskDependency } from '@ott/shared';
import { ChevronsDownUp, ChevronsUpDown, Columns3, Crosshair, Diamond, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useProjectMap } from '../../data/projects';
import { useCreateDependency, useCreateTask, useDeleteDependency, useDependencies, useScheduleTasks, useTasks } from '../../data/tasks';
import { useMembers, useUpdateWorkspace } from '../../data/workspace';
import { useIsAdmin, usePreferences, useWorkspace } from '../../app/session';
import { Button, IconButton } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/Confirm';
import { EmptyState, LoadingBlock } from '../../components/ui/EmptyState';
import { Switch } from '../../components/ui/Field';
import { toast } from '../../components/ui/Toast';
import { Segmented, Toolbar, ToolbarDivider, ToolbarSpacer } from '../../components/ui/Toolbar';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useWorkCalendar } from '../../lib/calendar';
import { useIsMobile, useStoredState } from '../../lib/hooks';
import { TaskImportButton } from '../tasks/TaskImportDialog';
import { useTaskPanel } from '../tasks/TaskPanelContext';
import { GanttChart } from './GanttChart';
import type { Zoom } from './ganttModel';
import styles from './ProjectGantt.module.css';

export function ProjectGantt({ project }: { project: Project }) {
  const t = useT();
  const format = useFormat();
  const confirm = useConfirm();
  const workspace = useWorkspace();
  const isAdmin = useIsAdmin();
  const { weekStart } = usePreferences();
  const panel = useTaskPanel();
  const projects = useProjectMap();
  const { data: allTasks = [], isLoading } = useTasks();
  const { data: allDependencies = [] } = useDependencies();
  const { data: memberList = [] } = useMembers();
  const schedule = useScheduleTasks();
  const createTask = useCreateTask();
  const createDependency = useCreateDependency();
  const deleteDependency = useDeleteDependency();
  const updateWorkspace = useUpdateWorkspace();
  const [zoom, setZoom] = useStoredState<Zoom>('ott.ganttZoom', 'days');
  const [showCritical, setShowCritical] = useStoredState('ott.ganttCritical', false);
  const [compactGrid, setCompactGrid] = useStoredState('ott.ganttCompact', false);
  // No celular a grade já fica só com o nome (GanttChart): o botão de colunas some.
  const mobile = useIsMobile();
  const [collapsed, setCollapsed] = useState<Set<Id>>(new Set());
  const [todaySignal, setTodaySignal] = useState(0);

  const tasks = useMemo(() => allTasks.filter((task) => task.projectId === project.id), [allTasks, project.id]);
  const taskIds = useMemo(() => new Set(tasks.map((task) => task.id)), [tasks]);
  const dependencies = useMemo(
    () => allDependencies.filter((dep) => taskIds.has(dep.predecessorId) && taskIds.has(dep.successorId)),
    [allDependencies, taskIds],
  );
  const members = useMemo(() => new Map(memberList.map((member) => [member.userId, member])), [memberList]);
  const { calendar, holidayNames } = useWorkCalendar();
  const plan = useMemo(() => computeCriticalPath(tasks, dependencies, calendar), [tasks, dependencies, calendar]);
  const parentIds = useMemo(() => new Set(tasks.map((task) => task.parentId).filter((id): id is Id => id !== null)), [tasks]);
  const late = Boolean(project.endDate && plan.projectEnd && plan.projectEnd > project.endDate);

  const addTask = (milestone: boolean) =>
    panel.openNew({ projectId: project.id, isMilestone: milestone });

  const removeDependency = async (dependency: TaskDependency) => {
    const ok = await confirm({ title: t.gantt.removeDependency, confirmLabel: t.common.remove });
    if (ok) deleteDependency.mutate(dependency.id, { onSuccess: () => toast.success(t.gantt.dependencyRemoved) });
  };

  if (isLoading) return <LoadingBlock />;

  return (
    <div className={styles.wrap}>
      <Toolbar>
        <Segmented<Zoom>
          value={zoom}
          onChange={setZoom}
          options={[
            { value: 'days', label: t.gantt.days },
            { value: 'weeks', label: t.gantt.weeks },
            { value: 'months', label: t.gantt.months },
          ]}
        />
        <Button size="sm" icon={<Crosshair />} onClick={() => setTodaySignal((value) => value + 1)}>
          {t.gantt.today}
        </Button>
        <ToolbarDivider />
        <label className={styles.toggle}>
          <Switch checked={showCritical} onChange={setShowCritical} label={t.gantt.criticalPath} />
          <span>{t.gantt.criticalPath}</span>
        </label>
        <label className={styles.toggle} title={isAdmin ? t.settings.autoScheduleHint : t.settings.adminOnly}>
          <Switch
            checked={workspace.autoSchedule}
            disabled={!isAdmin}
            onChange={(autoSchedule) => updateWorkspace.mutate({ autoSchedule })}
            label={t.gantt.autoSchedule}
          />
          <span>{t.gantt.autoSchedule}</span>
        </label>
        <ToolbarSpacer />
        {plan.projectEnd && (
          <span className={styles.end} data-late={late}>
            {t.gantt.projectEnd}: <strong>{format.dayLabel(plan.projectEnd)}</strong>
          </span>
        )}
        <IconButton
          icon={collapsed.size > 0 ? <ChevronsUpDown /> : <ChevronsDownUp />}
          label={collapsed.size > 0 ? t.gantt.expandAll : t.gantt.collapseAll}
          onClick={() => setCollapsed(collapsed.size > 0 ? new Set() : new Set(parentIds))}
        />
        {!mobile && <IconButton icon={<Columns3 />} label={t.gantt.columns} active={!compactGrid} onClick={() => setCompactGrid(!compactGrid)} />}
        <TaskImportButton projectId={project.id} size="sm" />
        <Button size="sm" icon={<Diamond />} onClick={() => addTask(true)}>
          {t.gantt.addMilestone}
        </Button>
        <Button size="sm" variant="primary" icon={<Plus />} onClick={() => addTask(false)}>
          {t.gantt.addTask}
        </Button>
      </Toolbar>
      {tasks.length === 0 ? (
        <EmptyState
          illustration="chart"
          title={t.gantt.emptyTitle}
          text={t.gantt.emptyText}
          action={
            <div className={styles.emptyActions}>
              <TaskImportButton projectId={project.id} />
              <Button variant="primary" icon={<Plus />} onClick={() => addTask(false)}>
                {t.tasks.createTask}
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <GanttChart
            tasks={tasks}
            dependencies={dependencies}
            projects={projects}
            members={members}
            zoom={zoom}
            showCritical={showCritical}
            autoSchedule={workspace.autoSchedule}
            calendar={calendar}
            holidayNames={holidayNames}
            weekStart={weekStart}
            collapsed={collapsed}
            compactGrid={compactGrid}
            todaySignal={todaySignal}
            onToggleCollapse={(id) =>
              setCollapsed((current) => {
                const next = new Set(current);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onOpenTask={(id) => panel.openTask(id)}
            onSchedule={(updates) => schedule.mutate({ updates })}
            onCreateDependency={(predecessorId, successorId) =>
              createDependency.mutate(
                { predecessorId, successorId, type: 'FS', lagDays: 0 },
                { onSuccess: () => toast.success(t.gantt.dependencyCreated) },
              )
            }
            onDeleteDependency={(dependency) => void removeDependency(dependency)}
            onQuickAdd={(name) => createTask.mutate({ name, projectId: project.id })}
          />
          <footer className={styles.legend}>
            <span>
              <i className={styles.legendBar} /> {t.gantt.legendTask}
            </span>
            <span>
              <i className={styles.legendSummary} /> {t.gantt.legendSummary}
            </span>
            <span>
              <i className={styles.legendMilestone} /> {t.gantt.legendMilestone}
            </span>
            {showCritical && (
              <span>
                <i className={styles.legendCritical} /> {t.gantt.legendCritical}
              </span>
            )}
            <span className={styles.hint}>{t.gantt.linkHint}</span>
          </footer>
        </>
      )}
    </div>
  );
}
