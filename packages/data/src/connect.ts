// Escolha do modo de dados. Com a configuração do Firebase presente, tenta o Firebase;
// sem configuração, ou se o Firebase não responder, usa o lowdb no navegador.
import type { FirebaseOptions } from 'firebase/app';
import { LowSync, type SyncAdapter } from 'lowdb';
import { LocalStorage } from 'lowdb/browser';
import { LocalAuth } from './auth/local';
import { createBackend, type Backend, type FallbackReason } from './backend';
import { emptyLocalData, LocalStore, type LocalData } from './store/local';

/** Chave do localStorage onde o modo local guarda tudo. */
export const LOCAL_STORAGE_KEY = 'ott.local.v1';

export type PreferredMode = 'auto' | 'firebase' | 'local';

export interface LocalBackendOptions {
  /** Adaptador do lowdb (padrão: localStorage do navegador). */
  adapter?: SyncAdapter<LocalData>;
  now?: () => Date;
  fallbackReason?: FallbackReason | null;
  fallbackDetail?: string | null;
}

export function createLocalBackend(options: LocalBackendOptions = {}): Backend {
  const adapter = options.adapter ?? new LocalStorage<LocalData>(LOCAL_STORAGE_KEY);
  const db = new LowSync<LocalData>(adapter, emptyLocalData());
  db.read();
  const store = new LocalStore(db);
  return createBackend({
    store,
    auth: new LocalAuth(db),
    now: options.now,
    fallbackReason: options.fallbackReason ?? null,
    fallbackDetail: options.fallbackDetail ?? null,
    reload: () => store.reload(),
  });
}

/** Configuração mínima para o Firebase funcionar (as demais chaves são opcionais). */
export function isFirebaseConfigured(config: Partial<FirebaseOptions> | null | undefined): config is FirebaseOptions {
  return Boolean(config?.apiKey && config.authDomain && config.projectId && config.appId);
}

export interface ConnectOptions {
  firebase: Partial<FirebaseOptions> | null;
  preferred?: PreferredMode;
  timeoutMs?: number;
  /** Emuladores locais do Firebase (desenvolvimento e testes de ponta a ponta). */
  emulator?: { host: string; firestorePort: number; authPort: number };
  local?: Omit<LocalBackendOptions, 'fallbackReason' | 'fallbackDetail'>;
}

export async function connect(options: ConnectOptions): Promise<Backend> {
  const preferred = options.preferred ?? 'auto';
  if (preferred !== 'local' && isFirebaseConfigured(options.firebase)) {
    try {
      const { connectFirebase } = await import('./firebase/index');
      const { store, auth } = await connectFirebase(options.firebase, {
        timeoutMs: options.timeoutMs,
        emulator: options.emulator,
      });
      return createBackend({ store, auth });
    } catch (error) {
      if (preferred === 'firebase') throw error;
      console.warn('Firebase indisponível, usando o modo local.', error);
      return createLocalBackend({
        ...options.local,
        fallbackReason: 'unreachable',
        fallbackDetail: (error as Error).message ?? String(error),
      });
    }
  }
  return createLocalBackend({
    ...options.local,
    fallbackReason: preferred === 'local' ? 'forced-local' : 'not-configured',
  });
}
