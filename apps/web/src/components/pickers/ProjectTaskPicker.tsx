// Seletor "Projeto ou tarefa" do cronômetro e das tarefas: busca, agrupa por cliente,
// abre as tarefas de cada projeto e permite criar projeto sem sair do fluxo.
import { PROJECT_COLORS, type Id, type Project, type Task } from '@ott/shared';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, CircleSlash, Plus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useCreateProject, useProjects } from '../../data/projects';
import { useTasks } from '../../data/tasks';
import { useClients } from '../../data/workspace';
import { useT } from '../../i18n';
import { Popover, type PopoverTriggerProps } from '../ui/Popover';
import { ColorDot } from '../ui/ProjectLabel';
import styles from './Picker.module.css';

export interface ProjectTaskValue {
  projectId: Id | null;
  taskId: Id | null;
}

interface Props {
  value: ProjectTaskValue;
  onChange: (value: ProjectTaskValue) => void;
  trigger: (props: PopoverTriggerProps) => ReactNode;
  /** Só projetos (o painel de tarefa não escolhe tarefa aqui). */
  projectsOnly?: boolean;
  placement?: 'bottom-start' | 'bottom-end';
}

export function ProjectTaskPicker({ value, onChange, trigger, projectsOnly = false, placement = 'bottom-start' }: Props) {
  const t = useT();
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: tasks = [] } = useTasks();
  const createProject = useCreateProject();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<Id>>(new Set());

  const normalized = query.trim().toLowerCase();
  const tasksByProject = useMemo(() => {
    const map = new Map<Id, Task[]>();
    for (const task of tasks) {
      if (task.projectId === null || task.status === 'done') continue;
      const list = map.get(task.projectId) ?? [];
      list.push(task);
      map.set(task.projectId, list);
    }
    return map;
  }, [tasks]);

  const groups = useMemo(() => {
    const clientName = new Map(clients.map((client) => [client.id, client.name]));
    const result = new Map<string, { project: Project; tasks: Task[] }[]>();
    const active = projects.filter((project) => !project.archived);
    for (const project of active) {
      const projectTasks = projectsOnly ? [] : (tasksByProject.get(project.id) ?? []);
      const matchesProject = !normalized || project.name.toLowerCase().includes(normalized);
      const matchingTasks = normalized
        ? projectTasks.filter((task) => task.name.toLowerCase().includes(normalized))
        : projectTasks;
      if (!matchesProject && matchingTasks.length === 0) continue;
      const key = project.clientId ? (clientName.get(project.clientId) ?? '') : t.projects.noClient;
      const list = result.get(key) ?? [];
      list.push({ project, tasks: matchesProject ? projectTasks : matchingTasks });
      result.set(key, list);
    }
    return [...result.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [projects, clients, tasksByProject, normalized, projectsOnly, t]);

  const toggle = (id: Id) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const nameTaken = projects.some((project) => project.name.toLowerCase() === normalized);

  return (
    <Popover trigger={trigger} width={320} placement={placement}>
      {({ close }) => {
        const pick = (next: ProjectTaskValue) => {
          onChange(next);
          setQuery('');
          close();
        };
        return (
          <div>
            <input
              className={styles.search}
              placeholder={t.common.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
            <div className={styles.list}>
              <button type="button" className={styles.option} onClick={() => pick({ projectId: null, taskId: null })}>
                <CircleSlash size={14} />
                <span className={styles.optionLabel}>{t.timer.noProject}</span>
              </button>
              {groups.map(([client, items]) => (
                <div key={client}>
                  <div className={styles.group}>{client}</div>
                  {items.map(({ project, tasks: projectTasks }) => {
                    const open = expanded.has(project.id) || (normalized !== '' && projectTasks.length > 0);
                    return (
                      <div key={project.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          className={clsx(styles.option, value.projectId === project.id && !value.taskId && styles.selected)}
                          onClick={() => pick({ projectId: project.id, taskId: null })}
                          onKeyDown={(event) => event.key === 'Enter' && pick({ projectId: project.id, taskId: null })}
                        >
                          <ColorDot color={project.color} />
                          <span className={styles.optionLabel} style={{ color: project.color }}>
                            {project.name}
                          </span>
                          {projectTasks.length > 0 && (
                            <button
                              type="button"
                              className={styles.expander}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggle(project.id);
                              }}
                              aria-label={t.tasks.title}
                            >
                              {projectTasks.length}
                              {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>
                          )}
                        </div>
                        {open &&
                          projectTasks.map((task) => (
                            <button
                              key={task.id}
                              type="button"
                              className={clsx(styles.option, styles.taskOption, value.taskId === task.id && styles.selected)}
                              onClick={() => pick({ projectId: project.id, taskId: task.id })}
                            >
                              <span className={styles.optionLabel}>{task.name}</span>
                            </button>
                          ))}
                      </div>
                    );
                  })}
                </div>
              ))}
              {groups.length === 0 && <div className={styles.empty}>{t.common.noResults}</div>}
              {normalized && !nameTaken && (
                <button
                  type="button"
                  className={clsx(styles.option, styles.create)}
                  onClick={async () => {
                    const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length]!;
                    const project = await createProject.mutateAsync({ name: query.trim(), color });
                    pick({ projectId: project.id, taskId: null });
                  }}
                >
                  <Plus size={14} />
                  <span className={styles.optionLabel}>{t.common.create_named(query.trim())}</span>
                </button>
              )}
            </div>
          </div>
        );
      }}
    </Popover>
  );
}
