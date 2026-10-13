// Avisos curtos no canto da tela. O armazenamento é um módulo simples para que
// código fora do React (cache de mutações) também consiga avisar erros.
import clsx from 'clsx';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { useT } from '../../i18n';
import styles from './Toast.module.css';

interface ToastItem {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
  action?: { label: string; onClick: () => void };
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function push(kind: ToastItem['kind'], message: string, action?: ToastItem['action'], persistent = false): number {
  const id = nextId++;
  items = [...items.slice(-3), { id, kind, message, action }];
  emit();
  if (!persistent) window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
  return id;
}

function dismiss(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

export const toast = {
  success: (message: string, action?: ToastItem['action']) => push('success', message, action),
  error: (message: string) => push('error', message),
  info: (message: string) => push('info', message),
  /** Fica até a pessoa agir ou fechar (por exemplo, versão nova do app). */
  persistent: (message: string, action: ToastItem['action']) => push('info', message, action, true),
};

export function Toaster() {
  const t = useT();
  const list = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => items,
  );
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {list.map((item) => (
        <div key={item.id} className={clsx(styles.toast, styles[item.kind])}>
          {item.kind === 'error' ? <CircleAlert size={16} /> : <CircleCheck size={16} />}
          <span className={styles.message}>{item.message}</span>
          {item.action && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                item.action!.onClick();
                dismiss(item.id);
              }}
            >
              {item.action.label}
            </button>
          )}
          <button type="button" className={styles.close} onClick={() => dismiss(item.id)} aria-label={t.common.close}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
