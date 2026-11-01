// Criar ou editar um status customizado: nome, categoria (qual status padrão ele conta
// como), ícone e cor do ícone. O escopo (workspace ou projeto) vem de quem abre e não
// muda depois de criado.
import { PROJECT_COLORS, STATUS_ICONS, TASK_STATUSES, type CustomStatus, type Id, type StatusIconKey, type TaskStatus } from '@ott/shared';
import clsx from 'clsx';
import { useState } from 'react';
import { useCreateStatus, useUpdateStatus } from '../../data/statuses';
import { ColorSwatches } from '../../components/pickers/ColorSwatches';
import { StatusGlyph, StatusIcon } from '../../components/pickers/TaskIcons';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import { Segmented } from '../../components/ui/Toolbar';
import { useT } from '../../i18n';
import styles from './Statuses.module.css';

export function StatusDialog({
  projectId,
  status,
  onClose,
  onSaved,
}: {
  projectId: Id | null;
  /** Status a editar; sem ele, cria um novo. */
  status?: CustomStatus;
  onClose: () => void;
  onSaved?: (status: CustomStatus) => void;
}) {
  const t = useT();
  const create = useCreateStatus();
  const update = useUpdateStatus();
  const [name, setName] = useState(status?.name ?? '');
  const [category, setCategory] = useState<TaskStatus>(status?.category ?? 'in_progress');
  const [icon, setIcon] = useState<StatusIconKey>(status?.icon ?? 'circle');
  const [color, setColor] = useState<string>(status?.color ?? PROJECT_COLORS[1]);
  const pending = create.isPending || update.isPending;

  const submit = () => {
    if (!name.trim() || pending) return;
    const values = { name: name.trim(), category, icon, color };
    const done = (saved: CustomStatus) => {
      if (!status) toast.success(t.statuses.created);
      onSaved?.(saved);
      onClose();
    };
    if (status) update.mutate({ id: status.id, ...values }, { onSuccess: done });
    else create.mutate({ ...values, projectId }, { onSuccess: done });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={status ? t.statuses.edit : t.statuses.create}
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" disabled={!name.trim()} loading={pending} onClick={submit}>
            {status ? t.common.save : t.common.create}
          </Button>
        </>
      }
    >
      <Field label={t.statuses.name}>
        {(id) => (
          <Input
            id={id}
            value={name}
            maxLength={40}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && submit()}
          />
        )}
      </Field>
      <Field label={t.statuses.category} hint={t.statuses.categoryHint}>
        {() => (
          <Segmented
            size="sm"
            value={category}
            onChange={setCategory}
            options={TASK_STATUSES.map((value) => ({
              value,
              label: t.tasks.statusLabels[value],
              icon: <StatusIcon status={value} size={14} />,
            }))}
          />
        )}
      </Field>
      <Field label={t.statuses.icon}>
        {() => (
          <div className={styles.icons} role="radiogroup" aria-label={t.statuses.icon}>
            {STATUS_ICONS.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={key === icon}
                aria-label={t.statuses.icons[key]}
                title={t.statuses.icons[key]}
                className={clsx(styles.iconOption, key === icon && styles.iconSelected)}
                onClick={() => setIcon(key)}
              >
                <StatusGlyph icon={key} color={color} size={18} />
              </button>
            ))}
          </div>
        )}
      </Field>
      <Field label={t.statuses.color}>
        {() => <ColorSwatches value={color} onChange={(swatch) => swatch && setColor(swatch)} label={t.statuses.color} />}
      </Field>
      <div className={styles.preview} aria-label={t.statuses.preview}>
        <span className={styles.previewLabel}>{t.statuses.preview}</span>
        <span className={styles.previewChip}>
          <StatusGlyph icon={icon} color={color} />
          {name.trim() || t.statuses.name}
        </span>
        <span className={styles.previewCategory}>{t.statuses.countsAs(t.tasks.statusLabels[category])}</span>
      </div>
    </Modal>
  );
}
