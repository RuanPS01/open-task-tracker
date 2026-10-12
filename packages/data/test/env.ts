// Ambientes de teste. As mesmas suítes rodam no modo local (lowdb em memória) e,
// quando há emulador, no modo Firebase (Firestore e Auth do emulador, com as regras
// de firestore.rules valendo de verdade).
import type { SessionResponse } from '@ott/shared';
import { MemorySync } from 'lowdb';
import { expect } from 'vitest';
import { createBackend, type Backend } from '../src/backend';
import { createLocalBackend } from '../src/connect';
import type { LocalData } from '../src/store/local';
import { randomId } from '../src/store/types';

export interface Account {
  name: string;
  email: string;
  password: string;
}

export interface Person {
  account: Account;
  uid: string;
  workspaceId: string;
  session: SessionResponse;
}

export interface TestEnv {
  mode: 'local' | 'firebase';
  backend: Backend;
  /** Cria a conta (com o workspace padrão) e deixa a pessoa logada. */
  signup(name: string): Promise<Person>;
  /** Troca a pessoa logada, como em outro navegador. */
  loginAs(person: Person): Promise<void>;
  dispose(): Promise<void>;
}

function withAccounts(mode: TestEnv['mode'], backend: Backend, dispose: () => Promise<void>): TestEnv {
  return {
    mode,
    backend,
    async signup(name) {
      const account = { name, email: `${name.toLowerCase()}-${randomId(6).toLowerCase()}@exemplo.com`, password: 'senha-segura' };
      const session = await backend.session.signup({ ...account, timezone: 'America/Sao_Paulo' });
      return { account, uid: session.user.id, workspaceId: session.workspaces[0]!.id, session };
    },
    async loginAs(person) {
      await backend.session.logout();
      await backend.session.login({ email: person.account.email, password: person.account.password });
    },
    dispose,
  };
}

export async function localEnv(): Promise<TestEnv> {
  const backend = createLocalBackend({ adapter: new MemorySync<LocalData>() });
  return withAccounts('local', backend, async () => undefined);
}

const hostPort = (value: string | undefined) => {
  const [host, port] = (value ?? '').split(':');
  return { host: host || '127.0.0.1', port: Number(port) };
};

/** Emulador presente quando a suíte roda dentro de `firebase emulators:exec`. */
export const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);

export async function firebaseEnv(): Promise<TestEnv> {
  const { connectFirebase } = await import('../src/firebase/index');
  const firestore = hostPort(process.env.FIRESTORE_EMULATOR_HOST);
  const auth = hostPort(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  const connection = await connectFirebase(
    { apiKey: 'demo-key', authDomain: 'localhost', projectId: process.env.GCLOUD_PROJECT ?? 'demo-ott', appId: 'demo-app' },
    {
      appName: `teste-${randomId(8)}`,
      emulator: { host: firestore.host, firestorePort: firestore.port, authPort: auth.port },
    },
  );
  const backend = createBackend({ store: connection.store, auth: connection.auth });
  return withAccounts('firebase', backend, () => connection.dispose());
}

export async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}
