// Avisos do modo de dados. No modo local os dados ficam só no navegador, então a
// pessoa precisa saber disso: um selo discreto na barra lateral e, quando o Firebase
// estava configurado mas não respondeu, uma faixa de alerta no topo.
import { HardDrive, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { backend } from '../data/backend';
import { useT } from '../i18n';
import styles from './DataModeNotice.module.css';

function useModeText(): string | null {
  const t = useT();
  const data = backend();
  if (data.mode !== 'local') return null;
  if (data.fallbackReason === 'unreachable') return t.dataMode.unreachable;
  if (data.fallbackReason === 'forced-local') return t.dataMode.forcedLocal;
  return t.dataMode.notConfigured;
}

/** Selo "Modo local" com a explicação no title. */
export function DataModeBadge({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const text = useModeText();
  if (!text) return null;
  return (
    <span className={styles.badge} title={text} aria-label={`${t.dataMode.local}. ${text}`}>
      <HardDrive size={14} aria-hidden />
      {!compact && <span>{t.dataMode.local}</span>}
    </span>
  );
}

/** Faixa de alerta quando o Firebase deveria estar em uso e não respondeu. */
export function FallbackBanner() {
  const t = useT();
  const data = backend();
  const [dismissed, setDismissed] = useState(false);
  if (data.mode !== 'local' || data.fallbackReason !== 'unreachable' || dismissed) return null;
  return (
    <div className={styles.banner} role="alert">
      <TriangleAlert size={16} aria-hidden />
      <span title={data.fallbackDetail ?? undefined}>{t.dataMode.unreachable}</span>
      <button type="button" className={styles.dismiss} onClick={() => setDismissed(true)}>
        {t.dataMode.dismiss}
      </button>
    </div>
  );
}

/** Nota na tela de login: explica onde os dados ficam no modo local. */
export function DataModeNote() {
  const text = useModeText();
  if (!text) return null;
  return (
    <p className={styles.note}>
      <HardDrive size={14} aria-hidden />
      <span>{text}</span>
    </p>
  );
}
