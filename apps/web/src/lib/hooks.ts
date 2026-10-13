import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Largura em que a interface vira a versão de celular (barra inferior, gaveta, painéis
 * em tela cheia). O CSS usa o mesmo valor: @media (max-width: 760px).
 */
export const MOBILE_MEDIA = '(max-width: 760px)';

function subscribeMobile(onChange: () => void): () => void {
  const query = window.matchMedia(MOBILE_MEDIA);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Tela de celular (ou janela estreita). Muda junto quando a tela gira ou a janela encolhe. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_MEDIA).matches,
    () => false,
  );
}

/** Data atual que se atualiza no intervalo pedido (cronômetro, linha de agora). */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Estado salvo no localStorage do navegador (só conveniências por pessoa). */
export function useStoredState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const update = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Armazenamento indisponível: o valor vale só nesta sessão.
    }
  };
  return [value, update];
}

/** Atalho de teclado global, ignorado enquanto o foco está num campo de texto. */
export function useHotkey(key: string, handler: (event: KeyboardEvent) => void, enabled = true): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
      if (typing || event.altKey) return;
      const wantsMod = key.startsWith('mod+');
      const plain = wantsMod ? key.slice(4) : key;
      if (wantsMod !== (event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() !== plain) return;
      handlerRef.current(event);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [key, enabled]);
}
