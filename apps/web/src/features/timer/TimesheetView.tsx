// Visão Planilha (timesheet): linhas por projeto e tarefa, colunas por dia.
// Digitar um total numa célula ajusta os apontamentos daquele dia:
// aumentar cria um apontamento com a diferença; diminuir encurta ou remove os
// apontamentos mais recentes da célula, como no Toggl.
import { compareIds, formatClock, toIsoDate, type Id, type Project, type TimeEntry } from '@ott/shared';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCreateTimeEntry, useDeleteTimeEntry, useUpdateTimeEntry } from '../../data/timeEntries';
import { ProjectTaskPicker } from '../../components/pickers/ProjectTaskPicker';
import { DurationInput } from '../../components/pickers/TimeInputs';
import { Button } from '../../components/ui/Button';
import { ProjectLabel } from '../../components/ui/ProjectLabel';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import styles from './TimesheetView.module.css';

interface RowKey {
  projectId: Id | null;
  taskId: Id | null;
}

const keyOf = (row: RowKey) => `${row.projectId ?? 0}:${row.taskId ?? 0}`;
const DEFAULT_START_HOUR = 9;

export function TimesheetView({
  days,
  entries,
  projects,
  tasksById,
}: {
  days: Date[];
  entries: TimeEntry[];
  projects: Map<Id, Project>;
  tasksById: Map<Id, string>;
}) {
  const t = useT();
  const format = useFormat();
  const create = useCreateTimeEntry();
  const update = useUpdateTimeEntry();
  const remove = useDeleteTimeEntry();
  const [extraRows, setExtraRows] = useState<RowKey[]>([]);
  const dayKeys = days.map(toIsoDate);

  const { rows, cells } = useMemo(() => {
    const rowMap = new Map<string, RowKey>();
    const cellMap = new Map<string, TimeEntry[]>();
    for (const entry of entries) {
      const row = { projectId: entry.projectId, taskId: entry.taskId };
      rowMap.set(keyOf(row), row);
      const cellKey = `${keyOf(row)}|${toIsoDate(new Date(entry.start))}`;
      const list = cellMap.get(cellKey) ?? [];
      list.push(entry);
      cellMap.set(cellKey, list);
    }
    for (const row of extraRows) rowMap.set(keyOf(row), row);
    const sorted = [...rowMap.values()].sort((a, b) => {
      const nameA = a.projectId ? (projects.get(a.projectId)?.name ?? '') : '';
      const nameB = b.projectId ? (projects.get(b.projectId)?.name ?? '') : '';
      return nameA.localeCompare(nameB) || compareIds(a.taskId ?? '', b.taskId ?? '');
    });
    return { rows: sorted, cells: cellMap };
  }, [entries, extraRows, projects]);

  const cellSeconds = (row: RowKey, day: string) =>
    (cells.get(`${keyOf(row)}|${day}`) ?? []).reduce((sum, entry) => sum + entry.duration, 0);

  const setCell = (row: RowKey, dayIndex: number, target: number) => {
    const day = dayKeys[dayIndex]!;
    const current = cellSeconds(row, day);
    const diff = target - current;
    if (diff === 0) return;
    if (diff > 0) {
      // Novo bloco começa depois do último apontamento do dia (ou às 9h).
      const dayEntries = entries.filter((entry) => toIsoDate(new Date(entry.start)) === day && entry.stop);
      const lastEnd = dayEntries.reduce<Date | null>((latest, entry) => {
        const end = new Date(entry.stop!);
        return !latest || end > latest ? end : latest;
      }, null);
      const start = lastEnd ?? new Date(days[dayIndex]!.getTime() + DEFAULT_START_HOUR * 3600_000);
      create.mutate({
        projectId: row.projectId,
        taskId: row.taskId,
        start: start.toISOString(),
        stop: new Date(start.getTime() + diff * 1000).toISOString(),
      });
      return;
    }
    let remaining = -diff;
    const list = [...(cells.get(`${keyOf(row)}|${day}`) ?? [])]
      .filter((entry) => entry.stop !== null)
      .sort((a, b) => b.start.localeCompare(a.start));
    for (const entry of list) {
      if (remaining <= 0) break;
      if (entry.duration <= remaining) {
        remove.mutate(entry.id);
        remaining -= entry.duration;
      } else {
        update.mutate({ id: entry.id, stop: new Date(Date.parse(entry.stop!) - remaining * 1000).toISOString() });
        remaining = 0;
      }
    }
  };

  const dayTotals = dayKeys.map((day) => rows.reduce((sum, row) => sum + cellSeconds(row, day), 0));
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0);

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.labelCol}>{t.timer.project}</th>
            {days.map((day) => (
              <th key={day.toISOString()} className={styles.dayCol}>
                <span className={styles.dayName}>{format.weekdayShort(day)}</span>
                <span className={styles.dayDate}>{format.dayMonth(day)}</span>
              </th>
            ))}
            <th className={styles.totalCol}>{t.common.total}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const project = row.projectId ? projects.get(row.projectId) : undefined;
            const rowTotal = dayKeys.reduce((sum, day) => sum + cellSeconds(row, day), 0);
            return (
              <tr key={keyOf(row)}>
                <td className={styles.labelCol}>
                  {project ? (
                    <ProjectLabel name={project.name} color={project.color} taskName={row.taskId ? tasksById.get(row.taskId) : null} />
                  ) : (
                    <span className={styles.muted}>{t.timer.noProject}</span>
                  )}
                </td>
                {dayKeys.map((day, index) => {
                  const seconds = cellSeconds(row, day);
                  return (
                    <td key={day} className={styles.dayCol}>
                      <DurationInput
                        className={styles.cell}
                        seconds={seconds}
                        display={seconds ? formatClock(seconds).replace(/:\d\d$/, '') : ''}
                        bareNumberUnit="hours"
                        allowEmpty
                        onCommit={(value) => setCell(row, index, value ?? 0)}
                        aria-label={`${project?.name ?? t.timer.noProject} ${format.dayLabel(day)}`}
                      />
                    </td>
                  );
                })}
                <td className={styles.totalCol}>{formatClock(rowTotal)}</td>
              </tr>
            );
          })}
          <tr>
            <td className={styles.labelCol} colSpan={days.length + 2}>
              <ProjectTaskPicker
                value={{ projectId: null, taskId: null }}
                onChange={(value) => setExtraRows((list) => [...list, value])}
                trigger={({ ref, getProps }) => (
                  <Button ref={ref} variant="ghost" size="sm" icon={<Plus />} {...getProps()}>
                    {t.timer.addRow}
                  </Button>
                )}
              />
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td className={styles.labelCol}>{t.common.total}</td>
            {dayTotals.map((total, index) => (
              <td key={dayKeys[index]} className={styles.dayCol}>
                {total ? formatClock(total) : '-'}
              </td>
            ))}
            <td className={styles.totalCol}>{formatClock(weekTotal)}</td>
          </tr>
        </tfoot>
      </table>
      <p className={styles.hint}>{t.timer.timesheetHint}</p>
    </div>
  );
}
