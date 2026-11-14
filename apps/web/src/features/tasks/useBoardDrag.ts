// Arraste dos cartões do Quadro por eventos de ponteiro (mouse, caneta e toque), no lugar
// do arrastar nativo do HTML. O nativo não rola o quadro nem a coluna perto das bordas,
// não desenha onde o cartão vai cair e não funciona no toque. Aqui: limiar de 4 px com
// mouse, pressão longa de 250 ms no toque (antes disso o dedo rola a tela), cartão
// fantasma seguindo o ponteiro, espaço reservado no destino e rolagem automática.
import type { Id } from '@ott/shared';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { dropIndex, edgeSpeed } from './boardModel';

export interface BoardDropTarget {
  /** Chave do status da coluna. */
  key: string;
  /** Posição na coluna, contando só os outros cartões. */
  index: number;
}

export interface BoardDragging {
  id: Id;
  width: number;
  height: number;
}

const MOUSE_THRESHOLD = 4;
const TOUCH_DELAY = 250;
const TOUCH_TOLERANCE = 8;
/** Distância da borda em que a rolagem automática começa, e velocidade máxima por quadro. */
const EDGE_ZONE = 72;
const MAX_SPEED = 22;
/** Elementos do cartão que têm ação própria e não começam arraste. */
const INTERACTIVE = 'button, a, input, textarea, select, [data-no-drag]';

/** O alvo é um controle do cartão (ou está dentro de um), e não o cartão em si. */
export function isInteractive(target: Element, card: Element): boolean {
  const control = target.closest(INTERACTIVE);
  return control !== null && control !== card && card.contains(control);
}

interface Session {
  id: Id;
  element: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  touch: boolean;
  drag: (BoardDragging & { offsetX: number; offsetY: number }) | null;
  timer: number;
  frame: number;
  cleanup: () => void;
}

export function useBoardDrag({
  boardRef,
  onDrop,
}: {
  boardRef: RefObject<HTMLElement | null>;
  onDrop: (id: Id, target: BoardDropTarget) => void;
}) {
  const [dragging, setDragging] = useState<BoardDragging | null>(null);
  const [target, setTarget] = useState<BoardDropTarget | null>(null);
  const session = useRef<Session | null>(null);
  const targetRef = useRef<BoardDropTarget | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const ghost = useRef<HTMLElement | null>(null);
  const suppressClick = useRef(false);
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  });

  // O fantasma anda pelo estilo direto, sem renderizar o quadro a cada movimento.
  const placeGhost = useCallback(() => {
    const drag = session.current?.drag;
    if (!ghost.current || !drag) return;
    ghost.current.style.transform = `translate(${pointer.current.x - drag.offsetX}px, ${pointer.current.y - drag.offsetY}px) rotate(2.5deg)`;
  }, []);

  const ghostRef = useCallback(
    (node: HTMLElement | null) => {
      ghost.current = node;
      placeGhost();
    },
    [placeGhost],
  );

  const findTarget = useCallback((): BoardDropTarget | null => {
    const board = boardRef.current;
    const drag = session.current?.drag;
    if (!board || !drag) return null;
    const { x, y } = pointer.current;
    // Coluna sob o ponteiro na horizontal; entre colunas ou fora do quadro, a mais próxima.
    let best: HTMLElement | null = null;
    let bestDistance = Infinity;
    for (const column of board.querySelectorAll<HTMLElement>('[data-column-key]')) {
      const rect = column.getBoundingClientRect();
      const distance = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
      if (distance < bestDistance) {
        best = column;
        bestDistance = distance;
      }
    }
    if (!best) return null;
    const list = best.querySelector<HTMLElement>('[data-column-list]') ?? best;
    const midpoints = [...list.querySelectorAll<HTMLElement>('[data-card-id]')]
      .filter((card) => card.dataset.cardId !== drag.id)
      .map((card) => {
        const rect = card.getBoundingClientRect();
        return rect.top + rect.height / 2;
      });
    return { key: best.dataset.columnKey ?? '', index: dropIndex(midpoints, y) };
  }, [boardRef]);

  const updateTarget = useCallback(() => {
    const next = findTarget();
    const current = targetRef.current;
    if (current?.key === next?.key && current?.index === next?.index) return;
    targetRef.current = next;
    setTarget(next);
  }, [findTarget]);

  const tick = useCallback(() => {
    const active = session.current;
    const board = boardRef.current;
    if (!active?.drag || !board) return;
    const { x, y } = pointer.current;
    const rect = board.getBoundingClientRect();
    let scrolled = false;
    const dx = edgeSpeed(x, rect.left, rect.right, EDGE_ZONE, MAX_SPEED);
    if (dx !== 0) {
      const before = board.scrollLeft;
      board.scrollLeft += dx;
      scrolled = board.scrollLeft !== before;
    }
    // Na vertical rola a lista de cartões da coluna de destino (cada coluna rola sozinha).
    const key = targetRef.current?.key;
    const column = key ? [...board.querySelectorAll<HTMLElement>('[data-column-key]')].find((item) => item.dataset.columnKey === key) : undefined;
    const list = column?.querySelector<HTMLElement>('[data-column-list]');
    if (list && list.scrollHeight > list.clientHeight) {
      const box = list.getBoundingClientRect();
      const dy = edgeSpeed(y, box.top, box.bottom, EDGE_ZONE, MAX_SPEED);
      if (dy !== 0) {
        const before = list.scrollTop;
        list.scrollTop += dy;
        scrolled = scrolled || list.scrollTop !== before;
      }
    }
    if (scrolled) updateTarget();
    active.frame = requestAnimationFrame(tick);
  }, [boardRef, updateTarget]);

  const begin = useCallback(
    (active: Session) => {
      const rect = active.element.getBoundingClientRect();
      active.drag = {
        id: active.id,
        width: rect.width,
        height: rect.height,
        offsetX: active.startX - rect.left,
        offsetY: active.startY - rect.top,
      };
      // Sem a captura implícita do toque, os eventos seguem o dedo até a coluna de destino.
      if (active.element.hasPointerCapture(active.pointerId)) active.element.releasePointerCapture(active.pointerId);
      document.documentElement.dataset.boardDragging = '';
      window.getSelection()?.removeAllRanges();
      if (active.touch) navigator.vibrate?.(10);
      setDragging({ id: active.id, width: rect.width, height: rect.height });
      updateTarget();
      active.frame = requestAnimationFrame(tick);
    },
    [tick, updateTarget],
  );

  const finish = useCallback((drop: boolean) => {
    const active = session.current;
    if (!active) return;
    session.current = null;
    active.cleanup();
    if (!active.drag) return;
    delete document.documentElement.dataset.boardDragging;
    // O clique que o navegador dispara depois de soltar não pode abrir o painel.
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const final = targetRef.current;
    targetRef.current = null;
    setDragging(null);
    setTarget(null);
    if (drop && final) onDropRef.current(active.id, final);
  }, []);

  const onPointerDown = useCallback(
    (id: Id) => (event: ReactPointerEvent<HTMLElement>) => {
      if (session.current) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      // Eventos de menus abertos pelo cartão chegam aqui pelo portal do React: só vale o que
      // está dentro do cartão e fora dos controles dele.
      const origin = event.target as HTMLElement;
      if (!event.currentTarget.contains(origin) || isInteractive(origin, event.currentTarget)) return;
      const active: Session = {
        id,
        element: event.currentTarget,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        touch: event.pointerType === 'touch',
        drag: null,
        timer: 0,
        frame: 0,
        cleanup: () => undefined,
      };
      pointer.current = { x: event.clientX, y: event.clientY };

      const move = (next: PointerEvent) => {
        if (next.pointerId !== active.pointerId) return;
        pointer.current = { x: next.clientX, y: next.clientY };
        if (!active.drag) {
          const distance = Math.hypot(next.clientX - active.startX, next.clientY - active.startY);
          // No toque, mexer o dedo antes da pressão longa é rolar a tela.
          if (active.touch) {
            if (distance > TOUCH_TOLERANCE) finish(false);
            return;
          }
          if (distance < MOUSE_THRESHOLD) return;
          begin(active);
        }
        placeGhost();
        updateTarget();
      };
      const up = (next: PointerEvent) => next.pointerId === active.pointerId && finish(true);
      const cancel = (next: PointerEvent) => next.pointerId === active.pointerId && finish(false);
      const key = (next: KeyboardEvent) => {
        if (next.key !== 'Escape' || !active.drag) return;
        next.preventDefault();
        next.stopPropagation();
        finish(false);
      };
      // Com o arraste ativo o dedo não pode rolar a página (exige ouvinte não passivo).
      const touchMove = (next: TouchEvent) => {
        if (active.drag) next.preventDefault();
      };
      const contextMenu = (next: Event) => {
        if (active.touch) next.preventDefault();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
      window.addEventListener('keydown', key, true);
      window.addEventListener('touchmove', touchMove, { passive: false });
      window.addEventListener('contextmenu', contextMenu);
      if (active.touch) {
        active.timer = window.setTimeout(() => {
          if (session.current === active) begin(active);
        }, TOUCH_DELAY);
      }
      active.cleanup = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('keydown', key, true);
        window.removeEventListener('touchmove', touchMove);
        window.removeEventListener('contextmenu', contextMenu);
        window.clearTimeout(active.timer);
        cancelAnimationFrame(active.frame);
      };
      session.current = active;
    },
    [begin, finish, placeGhost, updateTarget],
  );

  useEffect(
    () => () => {
      session.current?.cleanup();
      session.current = null;
      delete document.documentElement.dataset.boardDragging;
    },
    [],
  );

  return {
    dragging,
    target,
    ghostRef,
    onPointerDown,
    /** Verdadeiro logo depois de soltar: o clique desse gesto deve ser ignorado. */
    consumeClick: () => suppressClick.current,
  };
}
