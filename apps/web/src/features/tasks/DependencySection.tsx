// Dependências da tarefa no painel: "Depende de" (predecessoras) e "Bloqueia"
// (sucessoras), com tipo e atraso editáveis. Criar e remover também é possível
// arrastando no Gantt; aqui é o caminho acessível por teclado.
import {
  DEPENDENCY_TYPES,
  descendantIds,
  isAncestor,
  type DependencyType,
  type Task,
  type TaskDependency,
} from '@ott/shared';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useCreateDependency, useDeleteDependency, useDependencies, useUpdateDependency } from '../../api/tasks';
import pickerStyles from '../../components/pickers/Picker.module.css';
import { IconButton } from '../../components/ui/Button';
import { Popover } from '../../components/ui/Popover';
import { useT } from '../../i18n';
import { Section } from './TaskPanel';
import { useTaskPanel } from './TaskPanelContext';
import styles from './TaskPanel.module.css';

function DependencyRow({ dependency, other }: { dependency: TaskDependency; other: Task | undefined }) {
  const t = useT();
  const panel = useTaskPanel();
  const update = useUpdateDependency();
  const remove = useDeleteDependency();
  const [lag, setLag] = useState(String(dependency.lagDays));
  return (
    <div className={styles.dependency}>
      <button type="button" className={styles.dependencyName} onClick={() => other && panel.openTask(other.id)}>
        {other?.name ?? '?'}
      </button>
      <select
        className={styles.inlineSelect}
        value={dependency.type}
        onChange={(event) => update.mutate({ id: dependency.id, type: event.target.value as DependencyType })}
        aria-label={t.tasks.dependencies}
        title={t.tasks.dependencyTypes[dependency.type]}
      >
        {DEPENDENCY_TYPES.map((type) => (
          <option key={type} value={type}>
            {type} &middot; {t.tasks.dependencyTypes[type]}
          </option>
        ))}
      </select>
      <input
        className={styles.lagInput}
        type="number"
        value={lag}
        title={t.tasks.lag}
        aria-label={t.tasks.lag}
        onChange={(event) => setLag(event.target.value)}
        onBlur={() => {
          const value = Number.parseInt(lag, 10);
          if (Number.isFinite(value) && value !== dependency.lagDays) update.mutate({ id: dependency.id, lagDays: value });
          else setLag(String(dependency.lagDays));
        }}
      />
      <IconButton icon={<X />} label={t.common.remove} size="sm" onClick={() => remove.mutate(dependency.id)} />
    </div>
  );
}

export function DependencySection({ task, tasks }: { task: Task; tasks: Task[] }) {
  const t = useT();
  const { data: dependencies = [] } = useDependencies();
  const create = useCreateDependency();
  const [query, setQuery] = useState('');
  const byId = new Map(tasks.map((item) => [item.id, item]));
  const predecessors = dependencies.filter((dep) => dep.successorId === task.id);
  const successors = dependencies.filter((dep) => dep.predecessorId === task.id);
  const linked = new Set([...predecessors.map((d) => d.predecessorId), ...successors.map((d) => d.successorId)]);
  const blocked = new Set([task.id, ...descendantIds(tasks, task.id)]);
  const candidates = tasks.filter(
    (item) =>
      item.projectId === task.projectId &&
      !blocked.has(item.id) &&
      !linked.has(item.id) &&
      !isAncestor(tasks, item.id, task.id) &&
      item.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Section title={t.tasks.dependencies} count={predecessors.length + successors.length || undefined} defaultOpen={linked.size > 0}>
      {predecessors.length > 0 && <div className={styles.subheading}>{t.tasks.predecessors}</div>}
      {predecessors.map((dep) => (
        <DependencyRow key={dep.id} dependency={dep} other={byId.get(dep.predecessorId)} />
      ))}
      {successors.length > 0 && <div className={styles.subheading}>{t.tasks.successors}</div>}
      {successors.map((dep) => (
        <DependencyRow key={dep.id} dependency={dep} other={byId.get(dep.successorId)} />
      ))}
      <Popover
        width={300}
        trigger={({ ref, getProps }) => (
          <button ref={ref} type="button" className={styles.addLink} {...getProps()}>
            <Plus size={14} />
            {t.tasks.addPredecessor}
          </button>
        )}
      >
        {({ close }) => (
          <>
            <input className={pickerStyles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.common.search} autoFocus />
            <div className={pickerStyles.list}>
              {candidates.slice(0, 50).map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className={pickerStyles.option}
                  onClick={() => {
                    create.mutate({ predecessorId: candidate.id, successorId: task.id, type: 'FS', lagDays: 0 });
                    close();
                  }}
                >
                  <span className={pickerStyles.optionLabel}>{candidate.name}</span>
                </button>
              ))}
              {candidates.length === 0 && <div className={pickerStyles.empty}>{t.common.noResults}</div>}
            </div>
          </>
        )}
      </Popover>
    </Section>
  );
}
