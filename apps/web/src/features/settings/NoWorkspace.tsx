import { useState } from 'react';
import { useCreateWorkspace } from '../../data/workspace';
import { ColorSwatches } from '../../components/pickers/ColorSwatches';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Checkbox, Input } from '../../components/ui/Field';
import { useT } from '../../i18n';

/** Pessoa sem nenhum workspace ativo (foi removida de todos ou excluiu o último): oferece criar um. */
export function NoWorkspace() {
  const t = useT();
  const create = useCreateWorkspace();
  const [name, setName] = useState('');
  const [demo, setDemo] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  return (
    <EmptyState
      illustration="folders"
      title={t.nav.newWorkspace}
      action={
        <div style={{ display: 'grid', gap: 12, justifyItems: 'center', maxWidth: 420 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t.nav.newWorkspaceName}
              aria-label={t.nav.newWorkspaceName}
            />
            <Button
              variant="primary"
              disabled={!name.trim()}
              loading={create.isPending}
              onClick={() => create.mutate({ name: name.trim(), demo, color })}
            >
              {t.common.create}
            </Button>
          </div>
          <ColorSwatches value={color} onChange={setColor} label={t.nav.workspaceColor} withDefault />
          <Checkbox checked={demo} onChange={setDemo} label={t.nav.demoWorkspace} />
        </div>
      }
    />
  );
}
