// Escolha do modo de dados. Com a configuração do Firebase presente, tenta o Firebase;
// sem configuração, ou se o Firebase não responder, usa o lowdb no navegador.
import type { FirebaseOptions } from 'firebase/app';
import { LowSync, type SyncAdapter } from 'lowdb';
import { LocalStorage } from 'lowdb/browser';
import { LocalAuth } from './auth/local';
import { createBackend, type Backend, type FallbackReason } from './backend';
import { AppError } from './errors';
import { checkFirestoreDatabase } from './firebase/health';
import type { AuthGateway } from './auth/types';
import type { FirebaseConnectOptions } from './firebase/index';
import type { DocStore } from './store/types';
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
  /** fetch usado na checagem rápida do Firestore (os testes trocam). */
  fetch?: typeof fetch;
  /** Abertura do Firebase (os testes trocam por uma falsa, sem rede). */
  openFirebase?: OpenFirebase;
}

export async function connect(options: ConnectOptions): Promise<Backend> {
  const preferred = options.preferred ?? 'auto';
  if (preferred !== 'local' && isFirebaseConfigured(options.firebase)) {
    try {
      return await connectToFirebase(options.firebase, options);
    } catch (error) {
      if (preferred === 'firebase') throw error;
      console.warn('Firebase indisponível, usando o modo local.', error);
      return createLocalBackend({
        ...options.local,
        fallbackReason: (error as AppError).code === 'FIRESTORE_MISSING' ? 'firestore-missing' : 'unreachable',
        fallbackDetail: (error as Error).message ?? String(error),
      });
    }
  }
  return createLocalBackend({
    ...options.local,
    fallbackReason: preferred === 'local' ? 'forced-local' : 'not-configured',
  });
}

/** Quanto esperar o SDK antes de perguntar à API REST se o banco existe. */
const QUICK_CHECK_DELAY_MS = 1500;

type OpenFirebase = (config: FirebaseOptions, options: FirebaseConnectOptions) => Promise<{ store: DocStore; auth: AuthGateway }>;

const openFirebase: OpenFirebase = async (config, options) => (await import('./firebase/index')).connectFirebase(config, options);

/**
 * Abre o Firebase. Sem banco do Firestore no projeto, o SDK tenta de novo para sempre
 * (no navegador) ou só diz que está offline; por isso a API REST é consultada quando o
 * SDK falha ou não conecta em QUICK_CHECK_DELAY_MS. Se o banco não existir (ou a API
 * estiver desativada), o erro é FIRESTORE_MISSING e a espera acaba ali. No caminho
 * normal o SDK conecta antes e a consulta nem acontece. Nos emuladores o banco sempre existe.
 */
async function connectToFirebase(config: FirebaseOptions, options: ConnectOptions): Promise<Backend> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const controller = new AbortController();
  const diagnose = async () =>
    options.emulator ? null : checkFirestoreDatabase(config, { timeoutMs, fetch: options.fetch });
  const missing = (detail: string) => new AppError('FIRESTORE_MISSING', detail);

  let settled = false;
  const connecting = (options.openFirebase ?? openFirebase)(config, {
    timeoutMs,
    emulator: options.emulator,
    signal: controller.signal,
  }).catch(async (error: unknown) => {
    if (controller.signal.aborted) throw error;
    const health = await diagnose();
    throw health?.status === 'missing' ? missing(health.detail) : error;
  });
  connecting.then(
    () => (settled = true),
    () => (settled = true),
  );

  const never = new Promise<never>(() => undefined);
  const quick = options.emulator
    ? never
    : new Promise((resolve) => setTimeout(resolve, QUICK_CHECK_DELAY_MS)).then(async () => {
        if (settled) return never;
        const health = await diagnose();
        if (health?.status !== 'missing') return never;
        controller.abort();
        throw missing(health.detail);
      });
  const { store, auth } = await Promise.race([connecting, quick]);
  return createBackend({ store, auth });
}
