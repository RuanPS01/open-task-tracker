import type { Id, Tag } from '@ott/shared';
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useCreateTag, useDeleteTag, useRenameTag, useTags } from '../../data/workspace';
import { Button, IconButton } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/Confirm';
import { EmptyState, LoadingBlock } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Field';
import { Menu } from '../../components/ui/Menu';
import { useT } from '../../i18n';
import { PageHeader } from '../../layout/PageHeader';
import { useFormat } from '../../lib/format';
import { RenameCell } from './RenameCell';
import styles from './Manage.module.css';

export function TagsPage() {
  const t = useT();
  const format = useFormat();
  const confirm = useConfirm();
  const { data: tags = [], isLoading } = useTags();
  const create = useCreateTag();
  const rename = useRenameTag();
  const remove = useDeleteTag();
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [renaming, setRenaming] = useState<Id | null>(null);

  const submit = () => {
    if (!name.trim()) return;
    create.mutate(name.trim(), { onSuccess: () => setName('') });
  };
  const destroy = async (tag: Tag) => {
    const ok = await confirm({ title: t.tags.deleteTitle, text: t.tags.deleteText, confirmLabel: t.common.delete, danger: true });
    if (ok) remove.mutate(tag.id);
  };
  const visible = tags.filter((tag) => tag.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <>
      <PageHeader
        title={t.tags.title}
        actions={
          <label className={styles.search}>
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.tags.searchPlaceholder} />
          </label>
        }
      />
      <div className={styles.body}>
        <div className={styles.createRow}>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t.tags.name} onKeyDown={(event) => event.key === 'Enter' && submit()} />
          <Button variant="primary" icon={<Plus />} onClick={submit} loading={create.isPending} disabled={!name.trim()}>
            {t.tags.new}
          </Button>
        </div>
        {isLoading ? (
          <LoadingBlock />
        ) : tags.length === 0 ? (
          <EmptyState illustration="shapes" title={t.tags.emptyTitle} text={t.tags.emptyText} />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t.tags.name}</th>
                <th className={styles.mobileHidden}>{t.tags.created}</th>
                <th className={styles.actions} />
              </tr>
            </thead>
            <tbody>
              {visible.map((tag) => (
                <tr key={tag.id}>
                  <td>
                    {renaming === tag.id ? (
                      <RenameCell value={tag.name} onCancel={() => setRenaming(null)} onSave={(value) => rename.mutate({ id: tag.id, name: value }, { onSettled: () => setRenaming(null) })} />
                    ) : (
                      <span className={styles.badge}># {tag.name}</span>
                    )}
                  </td>
                  <td className={`${styles.muted} ${styles.mobileHidden}`}>{format.fullDate(tag.createdAt)}</td>
                  <td className={styles.actions}>
                    <Menu
                      placement="bottom-end"
                      trigger={({ ref, getProps }) => <IconButton ref={ref} icon={<MoreHorizontal />} label={t.common.more} size="sm" {...getProps()} />}
                      items={[
                        { key: 'rename', label: t.common.rename, icon: <Pencil />, onSelect: () => setRenaming(tag.id) },
                        { key: 'delete', label: t.common.delete, icon: <Trash2 />, danger: true, onSelect: () => void destroy(tag) },
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
