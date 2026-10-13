// Avisos do modo de dados. No modo local os dados ficam só no navegador, então a
// pessoa precisa saber disso: um selo discreto na barra lateral e, quando o Firebase
// estava configurado mas não respondeu (ou falta criar o banco), uma faixa de alerta no
// topo e um aviso em destaque na tela de login.
import { HardDrive, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { backend, firebaseProjectId } from '../data/backend';
import { useT } from '../i18n';
import styles from './DataModeNotice.module.css';

function useModeText(): string | null {
  const t = useT();
  const data = backend();
  if (data.mode !== 'local') return null;
  if (data.fallbackReason === 'unreachable') return t.dataMode.unreachable;
  if (data.fallbackReason === 'firestore-missing') return t.dataMode.firestoreMissing(firebaseProjectId());
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

/** O Firebase estava configurado, mas o modo local entrou no lugar. */
function isFallback(): boolean {
  const data = backend();
  return data.mode === 'local' && (data.fallbackReason === 'unreachable' || data.fallbackReason === 'firestore-missing');
}

/** Faixa de alerta quando o Firebase deveria estar em uso e não respondeu. */
export function FallbackBanner() {
  const t = useT();
  const text = useModeText();
  const [dismissed, setDismissed] = useState(false);
  if (!isFallback() || dismissed) return null;
  return (
    <div className={styles.banner} role="alert">
      <TriangleAlert size={16} aria-hidden />
      <span title={backend().fallbackDetail ?? undefined}>{text}</span>
      <button type="button" className={styles.dismiss} onClick={() => setDismissed(true)}>
        {t.dataMode.dismiss}
      </button>
    </div>
  );
}

/** Nota na tela de login: explica onde os dados ficam no modo local (em destaque quando o Firebase falhou). */
export function DataModeNote() {
  const text = useModeText();
  if (!text) return null;
  const warning = isFallback();
  return (
    <p className={clsx(styles.note, warning && styles.noteWarning)} role={warning ? 'alert' : undefined}>
      {warning ? <TriangleAlert size={14} aria-hidden /> : <HardDrive size={14} aria-hidden />}
      <span title={backend().fallbackDetail ?? undefined}>{text}</span>
    </p>
  );
}
