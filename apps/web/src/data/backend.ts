// Camada de dados em uso (Firebase ou local), escolhida uma vez na abertura do app
// (main.tsx). Os hooks deste diretório chamam backend() em vez de fazer requisições.
import { connect, type Backend, type PreferredMode } from '@ott/data';

let current: Backend | null = null;

export function backend(): Backend {
  if (!current) throw new Error('Camada de dados ainda não conectada');
  return current;
}

/** Configuração do Firebase vinda das variáveis VITE_FIREBASE_* (secrets no GitHub Actions). */
function firebaseConfig() {
  const env = import.meta.env;
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
}

/** Projeto do Firebase configurado (para os avisos de configuração incompleta). */
export function firebaseProjectId(): string {
  return import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '';
}

const PREFERRED: readonly PreferredMode[] = ['auto', 'firebase', 'local'];

/** Emuladores do Firebase em desenvolvimento: VITE_FIREBASE_EMULATOR_HOST=127.0.0.1 */
function emulator() {
  const host = import.meta.env.VITE_FIREBASE_EMULATOR_HOST;
  return host ? { host, firestorePort: 8080, authPort: 9099 } : undefined;
}

export async function connectBackend(): Promise<Backend> {
  const wanted = import.meta.env.VITE_DATA_MODE as PreferredMode | undefined;
  current = await connect({
    firebase: firebaseConfig(),
    preferred: wanted && PREFERRED.includes(wanted) ? wanted : 'auto',
    emulator: emulator(),
  });
  return current;
}
