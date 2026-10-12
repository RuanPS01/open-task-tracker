// Tela Projetos: tabela com período, status de tempo (registrado x estimado),
// faturamento e equipe, como a lista de projetos do Toggl Track.
import type { Member, Project } from '@ott/shared';
import clsx from 'clsx';
import { Archive, ArchiveRestore, Building2, MoreHorizontal, Pencil, Pin, Plus, Search, Star, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeleteProject, useProjects, useUpdateProject } from '../../api/projects';
import { useClients, useMembers } from '../../api/workspace';
import { useIsAdmin } from '../../app/session';
import { AvatarStack } from '../../components/ui/Avatar';
import { Button, IconButton } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/Confirm';
import { EmptyState, LoadingBlock } from '../../components/ui/EmptyState';
import { Menu } from '../../components/ui/Menu';
import { ColorDot } from '../../components/ui/ProjectLabel';
import { ChipButton, Segmented, Toolbar, ToolbarSpacer } from '../../components/ui/Toolbar';
import { useT } from '../../i18n';
import { PageHeader } from '../../layout/PageHeader';
import { useFormat } from '../../lib/format';
import { useStoredState } from '../../lib/hooks';
import { ProjectDialog } from './ProjectDialog';
import styles from './ProjectsPage.module.css';

type StatusFilter = 'active' | 'archived' | 'all';

export function TimeStatus({ project }: { project: Project }) {
  const t = useT();
  const format = useFormat();
  if (!project.estimateSeconds) {
    return (
      <span className={styles.timeStatus}>
        <span className="tabular">{format.hours(project.trackedSeconds)}</span>
      </span>
    );
  }
  const ratio = project.trackedSeconds / project.estimateSeconds;
  return (
    <span className={styles.timeStatus} title={ratio > 1 ? t.projects.overEstimate : undefined}>
      <span className="tabular">
        {format.hours(project.trackedSeconds)} / {format.hours(project.estimateSeconds)}
      </span>
      <span className={styles.bar}>
        <span className={clsx(ratio > 1 && styles.barOver)} style={{ width: `${Math.min(1, ratio) * 100}%` }} />
      </span>
    </span>
  );
}

export function ProjectsPage() {
  const t = useT();
  const format = useFormat();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const isAdmin = useIsAdmin();
  const { data: projects = [], isLoading } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: members = [] } = useMembers();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [status, setStatus] = useStoredState<StatusFilter>('ott.projectsStatus', 'active');
  const [clientFilter, setClientFilter] = useState<number | 'all' | 0>('all');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<{ project?: Project } | null>(null);

  const clientName = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);
  const memberMap = useMemo(() => new Map(members.map((member) => [member.userId, member])), [members]);

  const visible = projects
    .filter((project) => (status === 'all' ? true : status === 'archived' ? project.archived : !project.archived))
    .filter((project) => clientFilter === 'all' || (project.clientId ?? 0) === clientFilter)
    .filter((project) => project.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name));

  const remove = async (project: Project) => {
    const ok = await confirm({ title: t.projects.deleteTitle, text: t.projects.deleteText, confirmLabel: t.common.delete, danger: true });
    if (ok) deleteProject.mutate(project.id);
  };

  const clientLabel =
    clientFilter === 'all' ? t.common.all : clientFilter === 0 ? t.projects.noClient : (clientName.get(clientFilter) ?? '');

  return (
    <>
      <PageHeader
        title={t.projects.title}
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setDialog({})}>
            {t.projects.new}
          </Button>
        }
      />
      <Toolbar>
        <Segmented<StatusFilter>
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: t.projects.active },
            { value: 'archived', label: t.projects.archived },
            { value: 'all', label: t.projects.all },
          ]}
        />
        <Menu
          trigger={({ ref, getProps }) => (
            <ChipButton ref={ref} icon={<Building2 />} label={`${t.projects.client}:`} value={clientLabel} active={clientFilter !== 'all'} {...getProps()} />
          )}
          items={[
            { key: 'all', label: t.common.all, checked: clientFilter === 'all', onSelect: () => setClientFilter('all') },
            { key: 'none', label: t.projects.noClient, checked: clientFilter === 0, onSelect: () => setClientFilter(0) },
            'separator',
            ...clients.map((client) => ({
              key: `c${client.id}`,
              label: client.name,
              checked: clientFilter === client.id,
              onSelect: () => setClientFilter(client.id),
            })),
          ]}
        />
        <ToolbarSpacer />
        <label className={styles.search}>
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.projects.searchPlaceholder} />
        </label>
      </Toolbar>
      <div className={styles.body}>
        {isLoading ? (
          <LoadingBlock />
        ) : projects.length === 0 ? (
          <EmptyState
            illustration="folders"
            title={t.projects.emptyTitle}
            text={t.projects.emptyText}
            action={
              <Button variant="primary" icon={<Plus />} onClick={() => setDialog({})}>
                {t.projects.new}
              </Button>
            }
          />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.pinCol} />
                <th>{t.projects.title}</th>
                <th>{t.projects.client}</th>
                <th>{t.projects.timeframe}</th>
                <th>{t.projects.timeStatus}</th>
                <th>{t.projects.billableStatus}</th>
                <th>{t.projects.team}</th>
                <th className={styles.actionsCol} />
              </tr>
            </thead>
            <tbody>
              {visible.map((project) => {
                const team = project.memberIds
                  .map((id) => memberMap.get(id))
                  .filter((member): member is Member => Boolean(member))
                  .map((member) => ({ id: member.userId, name: member.name, avatarColor: member.avatarColor }));
                return (
                  <tr key={project.id} className={clsx(project.archived && styles.archived)} onClick={() => navigate(`/projects/${project.id}`)}>
                    <td className={styles.pinCol} onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        className={clsx(styles.pin, project.pinned && styles.pinned)}
                        onClick={() => updateProject.mutate({ id: project.id, pinned: !project.pinned })}
                        aria-label={project.pinned ? t.projects.unpin : t.projects.pin}
                        title={project.pinned ? t.projects.unpin : t.projects.pin}
                      >
                        <Star size={15} fill={project.pinned ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td>
                      <span className={styles.projectName}>
                        <ColorDot color={project.color} size={10} />
                        <span style={{ color: project.color }}>{project.name}</span>
                      </span>
                      <span className={styles.subline}>{t.projects.tasksDone(project.doneTaskCount, project.taskCount)}</span>
                    </td>
                    <td className={styles.muted}>{project.clientId ? clientName.get(project.clientId) : ''}</td>
                    <td className={styles.muted}>
                      {project.startDate && project.endDate ? format.range(project.startDate, project.endDate) : ''}
                    </td>
                    <td>
                      <TimeStatus project={project} />
                    </td>
                    <td className={styles.muted}>{project.billable ? t.projects.billable : t.projects.nonBillable}</td>
                    <td>{team.length > 0 && <AvatarStack people={team} size={22} max={5} />}</td>
                    <td className={styles.actionsCol} onClick={(event) => event.stopPropagation()}>
                      <Menu
                        placement="bottom-end"
                        trigger={({ ref, getProps }) => <IconButton ref={ref} icon={<MoreHorizontal />} label={t.common.more} size="sm" {...getProps()} />}
                        items={[
                          { key: 'edit', label: t.common.edit, icon: <Pencil />, onSelect: () => setDialog({ project }) },
                          {
                            key: 'pin',
                            label: project.pinned ? t.projects.unpin : t.projects.pin,
                            icon: <Pin />,
                            onSelect: () => updateProject.mutate({ id: project.id, pinned: !project.pinned }),
                          },
                          {
                            key: 'archive',
                            label: project.archived ? t.projects.restore : t.projects.archive,
                            icon: project.archived ? <ArchiveRestore /> : <Archive />,
                            onSelect: () => updateProject.mutate({ id: project.id, archived: !project.archived }),
                          },
                          ...(isAdmin
                            ? [
                                'separator' as const,
                                { key: 'delete', label: t.common.delete, icon: <Trash2 />, danger: true, onSelect: () => void remove(project) },
                              ]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!isLoading && projects.length > 0 && visible.length === 0 && <EmptyState compact illustration={null} title={t.common.noResults} />}
      </div>
      {dialog && (
        <ProjectDialog
          project={dialog.project}
          onClose={() => setDialog(null)}
          onCreated={(created) => navigate(`/projects/${created.id}/gantt`)}
        />
      )}
    </>
  );
}
