// Botão "Importar JSON". A importação é rara e o diálogo (prompt para IA, revisão em
// árvore) é grande: ele vem num pedaço separado do build, baixado só quando abre.
import type { Id } from '@ott/shared';
import { FileBraces } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { useT } from '../../i18n';

const TaskImportDialog = lazy(() => import('./TaskImportDialog').then((module) => ({ default: module.TaskImportDialog })));

export function TaskImportButton({ projectId = null, size = 'md' }: { projectId?: Id | null; size?: 'sm' | 'md' }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} icon={<FileBraces />} onClick={() => setOpen(true)} mobileIconOnly>
        {t.taskImport.button}
      </Button>
      {open && (
        <Suspense fallback={null}>
          <TaskImportDialog projectId={projectId} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
