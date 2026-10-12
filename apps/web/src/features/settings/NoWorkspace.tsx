import { useState } from 'react';
import { useCreateWorkspace } from '../../api/workspace';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Field';
import { useT } from '../../i18n';

/** Pessoa sem nenhum workspace ativo (foi removida de todos): oferece criar um. */
export function NoWorkspace() {
  const t = useT();
  const create = useCreateWorkspace();
  const [name, setName] = useState('');
  return (
    <EmptyState
      illustration="folders"
      title={t.nav.newWorkspace}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t.nav.newWorkspaceName} />
          <Button variant="primary" disabled={!name.trim()} loading={create.isPending} onClick={() => create.mutate(name.trim())}>
            {t.common.create}
          </Button>
        </div>
      }
    />
  );
}
