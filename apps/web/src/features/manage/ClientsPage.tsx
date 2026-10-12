import type { Client, Id } from '@ott/shared';
import clsx from 'clsx';
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useClients, useCreateClient, useDeleteClient, useUpdateClient } from '../../data/workspace';
import { Button, IconButton } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/Confirm';
import { EmptyState, LoadingBlock } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Field';
import { Menu } from '../../components/ui/Menu';
import { useT } from '../../i18n';
import { PageHeader } from '../../layout/PageHeader';
import { RenameCell } from './RenameCell';
import styles from './Manage.module.css';

export function ClientsPage() {
  const t = useT();
  const confirm = useConfirm();
  const { data: clients = [], isLoading } = useClients();
  const create = useCreateClient();
  const update = useUpdateClient();
  const remove = useDeleteClient();
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [renaming, setRenaming] = useState<Id | null>(null);

  const submit = () => {
    if (!name.trim()) return;
    create.mutate({ name: name.trim() }, { onSuccess: () => setName('') });
  };
  const destroy = async (client: Client) => {
    const ok = await confirm({ title: t.clients.deleteTitle, text: t.clients.deleteText, confirmLabel: t.common.delete, danger: true });
    if (ok) remove.mutate(client.id);
  };
  const visible = clients.filter((client) => client.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <>
      <PageHeader
        title={t.clients.title}
        actions={
          <label className={styles.search}>
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.clients.searchPlaceholder} />
          </label>
        }
      />
      <div className={styles.body}>
        <div className={styles.createRow}>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t.clients.name} onKeyDown={(event) => event.key === 'Enter' && submit()} />
          <Button variant="primary" icon={<Plus />} onClick={submit} loading={create.isPending} disabled={!name.trim()}>
            {t.clients.new}
          </Button>
        </div>
        {isLoading ? (
          <LoadingBlock />
        ) : clients.length === 0 ? (
          <EmptyState illustration="folders" title={t.clients.emptyTitle} text={t.clients.emptyText} />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t.clients.name}</th>
                <th>{t.projects.title}</th>
                <th>{t.projects.status}</th>
                <th className={styles.actions} />
              </tr>
            </thead>
            <tbody>
              {visible.map((client) => (
                <tr key={client.id} className={clsx(client.archived && styles.inactive)}>
                  <td>
                    {renaming === client.id ? (
                      <RenameCell value={client.name} onCancel={() => setRenaming(null)} onSave={(value) => update.mutate({ id: client.id, name: value }, { onSettled: () => setRenaming(null) })} />
                    ) : (
                      <strong>{client.name}</strong>
                    )}
                  </td>
                  <td className={styles.muted}>{t.clients.projects(client.projectCount)}</td>
                  <td>{client.archived && <span className={styles.badge}>{t.clients.archived}</span>}</td>
                  <td className={styles.actions}>
                    <Menu
                      placement="bottom-end"
                      trigger={({ ref, getProps }) => <IconButton ref={ref} icon={<MoreHorizontal />} label={t.common.more} size="sm" {...getProps()} />}
                      items={[
                        { key: 'rename', label: t.common.rename, icon: <Pencil />, onSelect: () => setRenaming(client.id) },
                        {
                          key: 'archive',
                          label: client.archived ? t.common.restore : t.common.archive,
                          icon: client.archived ? <ArchiveRestore /> : <Archive />,
                          onSelect: () => update.mutate({ id: client.id, archived: !client.archived }),
                        },
                        'separator',
                        { key: 'delete', label: t.common.delete, icon: <Trash2 />, danger: true, onSelect: () => void destroy(client) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

