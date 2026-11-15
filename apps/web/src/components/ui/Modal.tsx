// Diálogo modal centralizado: prende o foco, fecha com Esc e clique no fundo e trava a
// rolagem da página por baixo. Com `bare`, o conteúdo monta o próprio cabeçalho, corpo e
// rodapé (painel de tarefa).
import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { IconButton } from './Button';
import styles from './Modal.module.css';

interface BaseProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Bloqueia o fechamento por clique fora (formulário com dados digitados). */
  persistent?: boolean;
  className?: string;
  labelledBy?: string;
}

function useDialog(open: boolean, onClose: () => void, persistent: boolean) {
  const { refs, context } = useFloating({ open, onOpenChange: (next) => !next && onClose() });
  const dismiss = useDismiss(context, { outsidePress: !persistent, outsidePressEvent: 'mousedown' });
  const role = useRole(context, { role: 'dialog' });
  const { getFloatingProps } = useInteractions([dismiss, role]);
  return { refs, context, getFloatingProps };
}

export interface ModalProps extends BaseProps {
  title?: ReactNode;
  footer?: ReactNode;
  width?: number;
  /** Sem cabeçalho, corpo e rodapé próprios: o conteúdo monta o layout e a largura vem do `className`. */
  bare?: boolean;
  /** Índice do elemento focável que recebe o foco ao abrir (-1 para nenhum, quando o conteúdo escolhe). */
  initialFocus?: number;
}

export function Modal({
  open,
  onClose,
  title,
  footer,
  width = 480,
  children,
  persistent = false,
  className,
  bare = false,
  initialFocus = 0,
}: ModalProps) {
  const t = useT();
  const { refs, context, getFloatingProps } = useDialog(open, onClose, persistent);
  if (!open) return null;
  return (
    <FloatingPortal>
      <FloatingOverlay className={styles.overlay} lockScroll>
        <FloatingFocusManager context={context} initialFocus={initialFocus}>
          <div
            ref={refs.setFloating}
            className={clsx(styles.modal, className)}
            style={bare ? undefined : { width }}
            {...getFloatingProps()}
          >
            {bare ? (
              children
            ) : (
              <>
                {title && (
                  <header className={styles.header}>
                    <h2 className={styles.title}>{title}</h2>
                    <IconButton icon={<X />} label={t.common.close} size="sm" onClick={onClose} />
                  </header>
                )}
                <div className={styles.body}>{children}</div>
                {footer && <footer className={styles.footer}>{footer}</footer>}
              </>
            )}
          </div>
        </FloatingFocusManager>
      </FloatingOverlay>
    </FloatingPortal>
  );
}
