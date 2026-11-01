// Lista dos status de um escopo: os três padrão (fixos), os do workspace e, na página do
// projeto, os do projeto. Cada escopo edita só os próprios: os do workspace se alteram nas
// configurações do workspace (só administrador); os do projeto, na página do projeto.
import type { CustomStatus, Id } from '@ott/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useDeleteStatus } from '../../data/statuses';
import { StatusOptionIcon, useStatusCatalog } from '../../components/pickers/TaskStatus';
import { Button, IconButton } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/Confirm';
import { useT } from '../../i18n';
import { StatusDialog } from './StatusDialog';
import styles from './Statuses.module.css';

export function StatusList({ projectId, canEdit }: { projectId: Id | null; canEdit: boolean }) {
  const t = useT();
  const catalog = useStatusCatalog();
  const remove = useDeleteStatus();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<CustomStatus | 'new' | null>(null);

  const askRemove = async (status: CustomStatus) => {
    const ok = await confirm({
      title: t.statuses.deleteTitle(status.name),
      text: t.statuses.deleteText(t.tasks.statusLabels[status.category]),
      confirmLabel: t.common.delete,
      danger: true,
    });
    if (ok) remove.mutate(status.id);
  };

  return (
    <>
      <ul className={styles.list}>
        {catalog.optionsFor(projectId).map((option) => {
          const custom = option.custom;
          const editable = canEdit && custom !== null && custom.projectId === projectId;
          const tag = !custom ? t.statuses.defaultTag : custom.projectId ? t.statuses.projectTag : t.statuses.workspaceTag;
          return (
            <li key={option.key} className={styles.item}>
              <StatusOptionIcon option={option} />
              <span className={styles.name}>{option.label}</span>
              {custom && <span className={styles.category}>{t.statuses.countsAs(t.tasks.statusLabels[custom.category])}</span>}
              <span className={styles.tag}>{tag}</span>
              <span className={styles.actions}>
                {editable && (
                  <>
                    <IconButton icon={<Pencil />} label={t.statuses.edit} size="sm" onClick={() => setEditing(custom)} />
                    <IconButton icon={<Trash2 />} label={t.common.delete} size="sm" onClick={() => void askRemove(custom)} />
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {canEdit && (
        <div className={styles.footer}>
          <Button icon={<Plus />} onClick={() => setEditing('new')}>
            {t.statuses.create}
          </Button>
        </div>
      )}
      {editing && (
        <StatusDialog projectId={projectId} status={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
