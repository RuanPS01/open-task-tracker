// Confirmação assíncrona: `if (await confirm({...})) excluir()`.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useT } from '../../i18n';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmOptions {
  title: string;
  text?: string;
  confirmLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(value: boolean) => void>(() => undefined);

  const confirm = useCallback<ConfirmFn>((next) => {
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = (value: boolean) => {
    resolver.current(value);
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={options !== null}
        onClose={() => finish(false)}
        title={options?.title}
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => finish(false)}>
              {t.common.cancel}
            </Button>
            <Button variant={options?.danger ? 'danger' : 'primary'} onClick={() => finish(true)} autoFocus>
              {options?.confirmLabel ?? t.common.confirm}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {options?.text}
          {options?.danger && <> {t.common.cannotUndo}</>}
        </p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
