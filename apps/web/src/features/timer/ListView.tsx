// Visão Lista: apontamentos agrupados por dia, mais recente primeiro, com total diário,
// botão "continuar" e menu de ações. Descrição e projeto editáveis na própria linha.
import { formatClock, toIsoDate, type Project, type TimeEntry } from '@ott/shared';
import { CircleDollarSign, Copy, MoreVertical, Play, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useCreateTimeEntry, useDeleteTimeEntry, useStartTimer, useUpdateTimeEntry } from '../../api/timeEntries';
import { useTags } from '../../api/workspace';
import { ProjectTaskPicker } from '../../components/pickers/ProjectTaskPicker';
import pickerStyles from '../../components/pickers/Picker.module.css';
import { IconButton } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Menu } from '../../components/ui/Menu';
import { ProjectLabel } from '../../components/ui/ProjectLabel';
import { toast } from '../../components/ui/Toast';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import styles from './ListView.module.css';

function DescriptionCell({ entry }: { entry: TimeEntry }) {
  const t = useT();
  const update = useUpdateTimeEntry();
  const [value, setValue] = useState(entry.description);
  return (
    <input
      className={styles.description}
      value={value}
      placeholder={t.timer.addDescription}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => value !== entry.description && update.mutate({ id: entry.id, description: value })}
      onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
    />
  );
}

export function ListView({
  entries,
  projects,
  tasksById,
  onOpen,
}: {
  entries: TimeEntry[];
  projects: Map<number, Project>;
  tasksById: Map<number, string>;
  onOpen: (entry: TimeEntry) => void;
}) {
  const t = useT();
  const format = useFormat();
  const { data: tags = [] } = useTags();
  const update = useUpdateTimeEntry();
  const create = useCreateTimeEntry();
  const remove = useDeleteTimeEntry();
  const start = useStartTimer();

  if (entries.length === 0) {
    return <EmptyState illustration="clock" title={t.timer.emptyTitle} text={t.timer.emptyText} />;
  }

  const groups = new Map<string, TimeEntry[]>();
  for (const entry of [...entries].sort((a, b) => b.start.localeCompare(a.start))) {
    const key = toIsoDate(new Date(entry.start));
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }
  const todayKey = toIsoDate(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toIsoDate(yesterday);
  const tagName = new Map(tags.map((tag) => [tag.id, tag.name]));

  return (
    <div className={styles.list}>
      {[...groups.entries()].map(([day, items]) => {
        const total = items.reduce((sum, entry) => sum + entry.duration, 0);
        const label = day === todayKey ? t.common.today : day === yesterdayKey ? t.common.yesterday : format.dayLabel(day);
        return (
          <section key={day} className={styles.day}>
            <header className={styles.dayHeader}>
              <span>{label}</span>
              <span className={styles.dayTotal}>{formatClock(total)}</span>
            </header>
            {items.map((entry) => {
              const project = entry.projectId ? projects.get(entry.projectId) : undefined;
              const tagLabels = entry.tagIds.map((id) => tagName.get(id)).filter(Boolean);
              return (
                <div key={entry.id} className={styles.row} data-running={entry.stop === null}>
                  <DescriptionCell key={entry.description} entry={entry} />
                  <ProjectTaskPicker
                    value={{ projectId: entry.projectId, taskId: entry.taskId }}
                    onChange={(value) => update.mutate({ id: entry.id, ...value })}
                    trigger={({ ref, getProps }) => (
                      <button ref={ref} type="button" className={`${pickerStyles.trigger} ${styles.project}`} {...getProps()}>
                        {project ? (
                          <ProjectLabel
                            name={project.name}
                            color={project.color}
                            taskName={entry.taskId ? tasksById.get(entry.taskId) : null}
                          />
                        ) : (
                          <span className={pickerStyles.placeholder}>{t.timer.noProject}</span>
                        )}
                      </button>
                    )}
                  />
                  <span className={styles.tags} title={tagLabels.join(', ')}>
                    {tagLabels.length > 0 && (
                      <>
                        <Tag size={14} />
                        {tagLabels.length}
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    className={styles.billable}
                    data-on={entry.billable}
                    onClick={() => update.mutate({ id: entry.id, billable: !entry.billable })}
                    aria-label={t.timer.billable}
                    aria-pressed={entry.billable}
                    title={t.timer.billable}
                  >
                    <CircleDollarSign size={16} />
                  </button>
                  <button type="button" className={styles.range} onClick={() => onOpen(entry)}>
                    {format.time(entry.start)} - {entry.stop ? format.time(entry.stop) : '...'}
                  </button>
                  <button type="button" className={styles.duration} onClick={() => onOpen(entry)}>
                    {formatClock(entry.duration)}
                  </button>
                  <IconButton
                    icon={<Play fill="currentColor" />}
                    label={t.timer.continue}
                    size="sm"
                    className={styles.continue}
                    onClick={() =>
                      start.mutate({
                        description: entry.description,
                        projectId: entry.projectId,
                        taskId: entry.taskId,
                        tagIds: entry.tagIds,
                        billable: entry.billable,
                      })
                    }
                  />
                  <Menu
                    placement="bottom-end"
                    trigger={({ ref, getProps }) => (
                      <IconButton ref={ref} icon={<MoreVertical />} label={t.common.more} size="sm" {...getProps()} />
                    )}
                    items={[
                      {
                        key: 'dup',
                        label: t.common.duplicate,
                        icon: <Copy />,
                        disabled: entry.stop === null,
                        onSelect: () =>
                          create.mutate(
                            {
                              description: entry.description,
                              projectId: entry.projectId,
                              taskId: entry.taskId,
                              tagIds: entry.tagIds,
                              billable: entry.billable,
                              start: entry.start,
                              stop: entry.stop!,
                            },
                            { onSuccess: () => toast.success(t.timer.entryDuplicated) },
                          ),
                      },
                      {
                        key: 'del',
                        label: t.common.delete,
                        icon: <Trash2 />,
                        danger: true,
                        onSelect: () => remove.mutate(entry.id, { onSuccess: () => toast.success(t.timer.entryDeleted) }),
                      },
                    ]}
                  />
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
