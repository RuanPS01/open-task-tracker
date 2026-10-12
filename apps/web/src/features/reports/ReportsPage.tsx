// Relatórios (Toggl "Reports"): Resumo, Detalhado e Semanal sobre o mesmo recorte
// de filtros. Os números vêm da camada de dados (@ott/data, services/reports.ts).
import {
  diffDays,
  eachDay,
  NO_ID,
  toIsoDate,
  type Id,
  type IsoDate,
  type ReportDetailedRow,
  type ReportSummary,
} from '@ott/shared';
import { ChevronDown, ChevronRight, Download, FileText, LayoutGrid, PieChart, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useProjectMap } from '../../data/projects';
import { useDetailedReport, useDownloadCsv, useSummaryReport, type ReportParams } from '../../data/reports';
import { useTasks } from '../../data/tasks';
import { useClients, useMembers, useTags } from '../../data/workspace';
import { notifyError } from '../../app/notifier';
import { usePreferences, useWorkspace } from '../../app/session';
import { Donut, StackedColumns, StatTile } from '../../components/charts/Charts';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingBlock } from '../../components/ui/EmptyState';
import { ColorDot } from '../../components/ui/ProjectLabel';
import { Segmented, Toolbar, ToolbarSpacer } from '../../components/ui/Toolbar';
import { useT } from '../../i18n';
import { PageHeader } from '../../layout/PageHeader';
import { useFormat } from '../../lib/format';
import { useStoredState } from '../../lib/hooks';
import { BillableFilter, DateRangeControl, FILTER_ICONS, MultiFilter } from './ReportFilters';
import { aggregateDays, bucketFor, bucketKey, presetRange } from './reportRange';
import styles from './Reports.module.css';

type View = 'summary' | 'detailed' | 'weekly';

export function ReportsPage() {
  const t = useT();
  const { weekStart, timezone } = usePreferences();
  const projects = useProjectMap();
  const { data: members = [] } = useMembers();
  const { data: clients = [] } = useClients();
  const { data: tags = [] } = useTags();
  const [view, setView] = useStoredState<View>('ott.reportsView', 'summary');
  const initial = presetRange('thisWeek', toIsoDate(new Date()), weekStart);
  const [range, setRange] = useState(initial);
  const [userIds, setUserIds] = useState<Id[]>([]);
  const [projectIds, setProjectIds] = useState<Id[]>([]);
  const [clientIds, setClientIds] = useState<Id[]>([]);
  const [tagIds, setTagIds] = useState<Id[]>([]);
  const [billable, setBillable] = useState<'all' | 'true' | 'false'>('all');
  const [description, setDescription] = useState('');

  const params: ReportParams = {
    start: range.start,
    end: range.end,
    tz: timezone,
    userIds,
    projectIds,
    clientIds,
    tagIds,
    ...(billable === 'all' ? {} : { billable: billable === 'true' }),
    ...(description.trim() ? { description: description.trim() } : {}),
  };
  const downloadCsv = useDownloadCsv();
  const [exporting, setExporting] = useState(false);
  const exportCsv = () => {
    setExporting(true);
    downloadCsv(params)
      .catch(notifyError)
      .finally(() => setExporting(false));
  };

  return (
    <>
      <PageHeader
        title={t.reports.title}
        subtitle={view === 'summary' ? t.reports.summary : view === 'detailed' ? t.reports.detailed : t.reports.weekly}
        actions={
          <Button icon={<Download />} onClick={exportCsv} loading={exporting}>
            {t.reports.export}
          </Button>
        }
      />
      <Toolbar>
        <Segmented<View>
          value={view}
          onChange={setView}
          options={[
            { value: 'summary', label: t.reports.summary, icon: <PieChart /> },
            { value: 'detailed', label: t.reports.detailed, icon: <FileText /> },
            { value: 'weekly', label: t.reports.weekly, icon: <LayoutGrid /> },
          ]}
        />
      </Toolbar>
      <Toolbar className={styles.filters}>
        <DateRangeControl start={range.start} end={range.end} onChange={(start, end) => setRange({ start, end })} />
        <MultiFilter
          icon={FILTER_ICONS.members}
          label={t.reports.members}
          value={userIds}
          onChange={setUserIds}
          options={members.map((member) => ({
            id: member.userId,
            label: member.name,
            marker: <Avatar name={member.name} color={member.avatarColor} size={18} />,
          }))}
        />
        <MultiFilter
          icon={FILTER_ICONS.projects}
          label={t.reports.projects}
          value={projectIds}
          onChange={setProjectIds}
          options={[
            { id: NO_ID, label: t.reports.noProject },
            ...[...projects.values()].map((project) => ({ id: project.id, label: project.name, marker: <ColorDot color={project.color} /> })),
          ]}
        />
        <MultiFilter
          icon={FILTER_ICONS.clients}
          label={t.reports.clients}
          value={clientIds}
          onChange={setClientIds}
          options={[{ id: NO_ID, label: t.reports.noClient }, ...clients.map((client) => ({ id: client.id, label: client.name }))]}
        />
        <MultiFilter
          icon={FILTER_ICONS.tags}
          label={t.reports.tags}
          value={tagIds}
          onChange={setTagIds}
          options={tags.map((tag) => ({ id: tag.id, label: tag.name }))}
        />
        <BillableFilter value={billable} onChange={setBillable} />
        <label className={styles.description}>
          <Search size={14} />
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t.reports.descriptionPlaceholder} />
        </label>
        <ToolbarSpacer />
      </Toolbar>
      <div className={styles.body}>
        {view === 'summary' && <SummaryView params={params} />}
        {view === 'detailed' && <DetailedView params={params} />}
        {view === 'weekly' && <WeeklyView params={params} />}
      </div>
    </>
  );
}

function SummaryView({ params }: { params: ReportParams }) {
  const format = useFormat();
  const workspace = useWorkspace();
  const { weekStart } = usePreferences();
  const { data, isLoading, isPlaceholderData } = useSummaryReport(params);
  if (isLoading || !data) return <LoadingBlock />;
  return (
    <div className={isPlaceholderData ? styles.stale : undefined}>
      <SummaryContent data={data} currency={workspace.currency} weekStart={weekStart} format={format} />
    </div>
  );
}

function SummaryContent({
  data,
  currency,
  weekStart,
  format,
}: {
  data: ReportSummary;
  currency: ReportSummary['currency'];
  weekStart: number;
  format: ReturnType<typeof useFormat>;
}) {
  const t = useT();
  const projects = useProjectMap();
  const { data: tasks = [] } = useTasks();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const taskNames = useMemo(() => new Map(tasks.map((task) => [task.id, task.name])), [tasks]);
  const bucket = bucketFor(data.start, data.end);
  const columns = aggregateDays(data.byDay, bucket, weekStart);
  const workdays = data.byDay.filter((day) => day.seconds > 0).length;
  const hoursTick = (seconds: number) => `${Math.round(seconds / 3600)}h`;

  if (data.entryCount === 0) {
    return <EmptyState illustration="chart" title={t.reports.noData} />;
  }

  const columnLabel = (key: IsoDate) =>
    bucket === 'month' ? format.monthShort(key) : bucket === 'week' ? `${t.timer.weekShort}${format.week(key)}` : data.byDay.length <= 7 ? format.dayLabel(key) : format.dayMonth(key);

  return (
    <div className={styles.summary}>
      <div className={styles.tiles}>
        <StatTile label={t.reports.totalHours} value={format.duration(data.totalSeconds)} detail={t.reports.rows(data.entryCount)} />
        <StatTile
          label={t.reports.billableHours}
          value={format.duration(data.billableSeconds)}
          detail={format.percent(data.totalSeconds ? (data.billableSeconds / data.totalSeconds) * 100 : 0)}
        />
        <StatTile label={t.reports.amount} value={format.money(data.amount, currency)} />
        <StatTile label={t.reports.averageDaily} value={format.duration(workdays ? data.totalSeconds / workdays : 0)} />
      </div>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t.reports.durationByDay}</h2>
        <StackedColumns
          height={240}
          unit={3600}
          formatValue={format.hours}
          formatTick={hoursTick}
          series={[
            { key: 'billable', label: t.reports.billableLegend, color: 'var(--chart-billable)' },
            { key: 'nonbillable', label: t.reports.nonBillableLegend, color: 'var(--chart-nonbillable)' },
          ]}
          data={columns.map((column) => ({
            key: column.key,
            label: columnLabel(column.key),
            values: [column.billableSeconds, column.seconds - column.billableSeconds],
          }))}
        />
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t.reports.projectsBreakdown}</h2>
        <Donut
          formatValue={format.hours}
          centerLabel={t.common.total}
          otherLabel={t.reports.other}
          data={data.byProject.map((row) => {
            const project = row.projectId ? projects.get(row.projectId) : undefined;
            return {
              key: row.projectId ?? NO_ID,
              label: project?.name ?? t.reports.noProject,
              value: row.seconds,
              color: project?.color ?? 'var(--chart-other)',
            };
          })}
        />
      </section>

      <section className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t.reports.project}</th>
              <th className={styles.num}>{t.reports.duration}</th>
              <th className={styles.num}>{t.reports.share}</th>
              <th className={styles.num}>{t.reports.amount}</th>
            </tr>
          </thead>
          <tbody>
            {data.byProject.map((row) => {
              const key = row.projectId ?? NO_ID;
              const project = row.projectId ? projects.get(row.projectId) : undefined;
              const expanded = open.has(key);
              return (
                <ProjectRows
                  key={key}
                  expanded={expanded}
                  onToggle={() =>
                    setOpen((current) => {
                      const next = new Set(current);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                  label={project?.name ?? t.reports.noProject}
                  color={project?.color}
                  seconds={row.seconds}
                  share={data.totalSeconds ? (row.seconds / data.totalSeconds) * 100 : 0}
                  amount={format.money(row.amount, currency)}
                  items={row.items.map((item) => ({
                    label: item.description || (item.taskId ? (taskNames.get(item.taskId) ?? '') : '') || t.reports.noDescription,
                    seconds: item.seconds,
                  }))}
                />
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>{t.common.total}</td>
              <td className={styles.num}>{format.duration(data.totalSeconds)}</td>
              <td className={styles.num}>100%</td>
              <td className={styles.num}>{format.money(data.amount, currency)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
    </div>
  );
}

function ProjectRows({
  expanded,
  onToggle,
  label,
  color,
  seconds,
  share,
  amount,
  items,
}: {
  expanded: boolean;
  onToggle: () => void;
  label: string;
  color?: string;
  seconds: number;
  share: number;
  amount: string;
  items: { label: string; seconds: number }[];
}) {
  const format = useFormat();
  return (
    <>
      <tr className={styles.groupRow} onClick={onToggle}>
        <td>
          <span className={styles.groupLabel}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {color && <ColorDot color={color} />}
            {label}
          </span>
        </td>
        <td className={styles.num}>{format.duration(seconds)}</td>
        <td className={styles.num}>{format.percent(share)}</td>
        <td className={styles.num}>{amount}</td>
      </tr>
      {expanded &&
        items.map((item, index) => (
          <tr key={index} className={styles.itemRow}>
            <td>{item.label}</td>
            <td className={styles.num}>{format.duration(item.seconds)}</td>
            <td className={styles.num}>{format.percent(seconds ? (item.seconds / seconds) * 100 : 0)}</td>
            <td />
          </tr>
        ))}
    </>
  );
}

const PAGE_SIZE = 100;

function DetailedView({ params }: { params: ReportParams }) {
  const t = useT();
  const format = useFormat();
  const workspace = useWorkspace();
  const projects = useProjectMap();
  const { data: members = [] } = useMembers();
  const { data: tags = [] } = useTags();
  const { data: tasks = [] } = useTasks();
  const { data, isLoading, isPlaceholderData } = useDetailedReport(params);
  const [page, setPage] = useState(0);
  if (isLoading || !data) return <LoadingBlock />;
  if (data.rows.length === 0) return <EmptyState illustration="chart" title={t.reports.noData} />;
  const memberMap = new Map(members.map((member) => [member.userId, member]));
  const tagMap = new Map(tags.map((tag) => [tag.id, tag.name]));
  const taskMap = new Map(tasks.map((task) => [task.id, task.name]));
  const pages = Math.ceil(data.rows.length / PAGE_SIZE);
  const rows = data.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className={isPlaceholderData ? styles.stale : undefined}>
      <div className={styles.detailedTotals}>
        <span>
          {t.reports.totalHours}: <strong>{format.duration(data.totalSeconds)}</strong>
        </span>
        <span>
          {t.reports.billableHours}: <strong>{format.duration(data.billableSeconds)}</strong>
        </span>
        <span>
          {t.reports.amount}: <strong>{format.money(data.amount, workspace.currency)}</strong>
        </span>
        <span className={styles.muted}>{t.reports.rows(data.rows.length)}</span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t.reports.description}</th>
            <th>{t.reports.project}</th>
            <th>{t.reports.member}</th>
            <th>{t.reports.date}</th>
            <th>{t.reports.time}</th>
            <th className={styles.num}>{t.reports.duration}</th>
            <th className={styles.num}>{t.reports.amount}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: ReportDetailedRow) => {
            const project = row.projectId ? projects.get(row.projectId) : undefined;
            const member = memberMap.get(row.userId);
            return (
              <tr key={row.id}>
                <td>
                  <span className={styles.entryDescription}>{row.description || t.reports.noDescription}</span>
                  {row.tagIds.length > 0 && <span className={styles.entryTags}>{row.tagIds.map((id) => tagMap.get(id)).join(', ')}</span>}
                </td>
                <td>
                  {project ? (
                    <span className={styles.groupLabel}>
                      <ColorDot color={project.color} />
                      {project.name}
                      {row.taskId && <span className={styles.muted}>: {taskMap.get(row.taskId)}</span>}
                    </span>
                  ) : (
                    <span className={styles.muted}>{t.reports.noProject}</span>
                  )}
                </td>
                <td>
                  {member && (
                    <span className={styles.groupLabel}>
                      <Avatar name={member.name} color={member.avatarColor} size={20} />
                      {member.name}
                    </span>
                  )}
                </td>
                <td className={styles.nowrap}>{format.dayMonth(row.date)}</td>
                <td className={styles.nowrap}>
                  {format.time(row.start)} - {row.stop ? format.time(row.stop) : '...'}
                </td>
                <td className={styles.num}>{format.duration(row.seconds)}</td>
                <td className={styles.num}>{row.billable ? format.money(row.amount, workspace.currency) : '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pages > 1 && (
        <div className={styles.pager}>
          <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            {t.common.previous}
          </Button>
          <span>
            {page + 1} / {pages}
          </span>
          <Button size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            {t.common.next}
          </Button>
        </div>
      )}
    </div>
  );
}

function WeeklyView({ params }: { params: ReportParams }) {
  const t = useT();
  const format = useFormat();
  const projects = useProjectMap();
  const { weekStart } = usePreferences();
  const { data, isLoading, isPlaceholderData } = useDetailedReport(params);
  if (isLoading || !data) return <LoadingBlock />;
  if (data.rows.length === 0) return <EmptyState illustration="chart" title={t.reports.noData} />;

  // Até 14 dias, uma coluna por dia; acima disso, uma por semana.
  const byDay = diffDays(data.start, data.end) < 14;
  const bucket = byDay ? 'day' : 'week';
  const keyOf = (date: IsoDate) => bucketKey(date, bucket, weekStart);
  const columns = [...new Set(eachDay(data.start, data.end).map(keyOf))];

  const grid = new Map<string, Map<string, number>>();
  for (const row of data.rows) {
    const projectKey = row.projectId ?? NO_ID;
    const cells = grid.get(projectKey) ?? new Map<string, number>();
    const column = keyOf(row.date);
    cells.set(column, (cells.get(column) ?? 0) + row.seconds);
    grid.set(projectKey, cells);
  }
  const rowKeys = [...grid.keys()].sort((a, b) => {
    const total = (key: string) => [...grid.get(key)!.values()].reduce((x, y) => x + y, 0);
    return total(b) - total(a);
  });
  const columnTotal = (column: string) => rowKeys.reduce((sum, key) => sum + (grid.get(key)!.get(column) ?? 0), 0);

  return (
    <div className={isPlaceholderData ? styles.stale : undefined}>
      <div className={styles.weeklyWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t.reports.project}</th>
              {columns.map((column) => (
                <th key={column} className={styles.num}>
                  {byDay ? format.dayLabel(column) : `${t.timer.weekShort}${format.week(column)}`}
                </th>
              ))}
              <th className={styles.num}>{t.reports.weekTotal}</th>
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((key) => {
              const project = key !== NO_ID ? projects.get(key) : undefined;
              const cells = grid.get(key)!;
              const total = [...cells.values()].reduce((a, b) => a + b, 0);
              return (
                <tr key={key}>
                  <td>
                    <span className={styles.groupLabel}>
                      {project && <ColorDot color={project.color} />}
                      {project?.name ?? t.reports.noProject}
                    </span>
                  </td>
                  {columns.map((column) => (
                    <td key={column} className={styles.num}>
                      {cells.get(column) ? format.duration(cells.get(column)!) : '-'}
                    </td>
                  ))}
                  <td className={styles.num}>
                    <strong>{format.duration(total)}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>{t.common.total}</td>
              {columns.map((column) => (
                <td key={column} className={styles.num}>
                  {format.duration(columnTotal(column))}
                </td>
              ))}
              <td className={styles.num}>{format.duration(data.totalSeconds)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
