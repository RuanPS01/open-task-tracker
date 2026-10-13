// Exclusão do workspace (só administrador). Apaga tudo para todas as pessoas, então a
// confirmação pede o nome do workspace digitado, e não só um clique.
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeleteWorkspace } from '../../data/workspace';
import { useWorkspace } from '../../app/session';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import { useT } from '../../i18n';
import styles from './Settings.module.css';

export function DeleteWorkspaceSection() {
  const t = useT();
  const workspace = useWorkspace();
  const remove = useDeleteWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === workspace.name.trim();

  const close = () => {
    setOpen(false);
    setTyped('');
  };

  const confirm = async () => {
    const name = workspace.name;
    // mutateAsync, e não mutate com onSuccess: com a sessão nova a tela do workspace
    // apagado desmonta e o callback do mutate não chegaria a rodar. O erro já vira aviso.
    const done = await remove.mutateAsync().then(
      () => true,
      () => false,
    );
    if (!done) return;
    toast.success(t.settings.deleted(name));
    navigate('/timer');
  };

  return (
    <section className={`${styles.section} ${styles.danger}`}>
      <h2 className={styles.sectionTitle}>{t.settings.deleteSection}</h2>
      <p className={styles.sectionHint}>{t.settings.deleteHint}</p>
      <div className={styles.actions}>
        <Button variant="danger" icon={<Trash2 />} onClick={() => setOpen(true)}>
          {t.settings.deleteButton}
        </Button>
      </div>
      <Modal
        open={open}
        onClose={close}
        persistent={remove.isPending}
        title={t.settings.deleteTitle}
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={remove.isPending}>
              {t.common.cancel}
            </Button>
            <Button variant="danger" disabled={!matches} loading={remove.isPending} onClick={() => void confirm()}>
              {t.settings.deleteConfirm}
            </Button>
          </>
        }
      >
        <p className={styles.modalText}>{t.settings.deleteText(workspace.name)}</p>
        <Field label={t.settings.deleteConfirmLabel(workspace.name)}>
          {(id) => (
            <Input
              id={id}
              value={typed}
              autoComplete="off"
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && matches && !remove.isPending && void confirm()}
            />
          )}
        </Field>
      </Modal>
    </section>
  );
}
