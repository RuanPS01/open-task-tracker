// PWA: registro do service worker (só no build publicado), aviso de versão nova e o
// convite de instalação do navegador (Chrome, Edge e Android; o iPhone usa o menu
// Compartilhar). Os textos ficam nas telas (PwaBridge, menu do usuário e perfil).
import { useSyncExternalStore } from 'react';

/** Evento do Chrome e do Edge que permite abrir a instalação por um botão próprio. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  /** Aplica a versão nova já baixada (recarrega a página); null sem versão nova. */
  applyUpdate: (() => void) | null;
  /** Abre a instalação do navegador; null quando ele não oferece (ou já instalou). */
  install: (() => Promise<void>) | null;
  /** Aberto como aplicativo instalado. */
  standalone: boolean;
}

const listeners = new Set<() => void>();
let state: PwaState = { applyUpdate: null, install: null, standalone: false };

function set(changes: Partial<PwaState>): void {
  state = { ...state, ...changes };
  listeners.forEach((listener) => listener());
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** Guarda o convite de instalação. Precisa rodar cedo, antes de o navegador desistir. */
export function listenInstallPrompt(): void {
  set({ standalone: isStandalone() });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    const prompt = event as BeforeInstallPromptEvent;
    set({
      install: async () => {
        await prompt.prompt();
        await prompt.userChoice;
        set({ install: null });
      },
    });
  });
  window.addEventListener('appinstalled', () => set({ install: null }));
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const register = () => {
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .then(watchUpdates)
      .catch((error: unknown) => console.warn('Service worker não registrado.', error));
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

function watchUpdates(registration: ServiceWorkerRegistration): void {
  let reloading = false;
  const offer = (worker: ServiceWorker) =>
    set({
      applyUpdate: () => {
        reloading = true;
        worker.postMessage('skip-waiting');
      },
    });
  // Versão nova só vale quando já havia uma em uso (na primeira visita não há aviso).
  if (registration.waiting && navigator.serviceWorker.controller) offer(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) window.location.reload();
  });
  // Procura versão nova ao voltar para o app e de hora em hora.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void registration.update().catch(() => undefined);
  });
  window.setInterval(() => void registration.update().catch(() => undefined), 60 * 60 * 1000);
}

export function usePwa(): PwaState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
