// Popover genérico (seletores, menus, filtros) sobre o floating-ui: posiciona,
// fecha com Esc e clique fora, e devolve o foco para o gatilho ao fechar.
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  type Placement,
} from '@floating-ui/react';
import clsx from 'clsx';
import { useState, type HTMLProps, type ReactNode } from 'react';
import styles from './Popover.module.css';

export interface PopoverTriggerProps {
  ref: (node: HTMLElement | null) => void;
  open: boolean;
  getProps: (userProps?: HTMLProps<Element>) => Record<string, unknown>;
}

export interface PopoverProps {
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode | ((api: { close: () => void }) => ReactNode);
  placement?: Placement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Largura fixa em px ou igual à do gatilho. */
  width?: number | 'trigger';
  className?: string;
  /** Índice do elemento focável que recebe o foco ao abrir (-1 para nenhum). */
  initialFocus?: number;
  role?: 'dialog' | 'menu' | 'listbox';
}

export function Popover({
  trigger,
  children,
  placement = 'bottom-start',
  open: controlledOpen,
  onOpenChange,
  width,
  className,
  initialFocus = 0,
  role = 'dialog',
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, rects, elements }) {
          elements.floating.style.maxHeight = `${Math.max(160, availableHeight)}px`;
          if (width === 'trigger') elements.floating.style.width = `${rects.reference.width}px`;
        },
      }),
    ],
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const ariaRole = useRole(context, { role });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, ariaRole]);
  const close = () => setOpen(false);

  return (
    <>
      {trigger({ ref: refs.setReference, open, getProps: getReferenceProps })}
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={initialFocus} returnFocus>
            <div
              ref={refs.setFloating}
              className={clsx(styles.popover, className)}
              style={{ ...floatingStyles, ...(typeof width === 'number' ? { width } : {}) }}
              {...getFloatingProps()}
            >
              {typeof children === 'function' ? children({ close }) : children}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
