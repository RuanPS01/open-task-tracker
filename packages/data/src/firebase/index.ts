// Modo Firebase: Firestore como armazenamento e Firebase Auth como login. Este módulo
// é carregado sob demanda (import dinâmico), então quem usa só o modo local não baixa
// o SDK do Firebase.
import { deleteApp, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updatePassword,
  type Auth,
  type UserCredential,
} from 'firebase/auth';
import {
  arrayRemove,
  arrayUnion,
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  increment,
  initializeFirestore,
  query,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { AuthGateway } from '../auth/types';
import { AppError, badRequest } from '../errors';
import {
  ArrayRemove,
  ArrayUnion,
  Increment,
  randomId,
  type DocStore,
  type Filter,
  type WriteOp,
} from '../store/types';

/** Limite do Firestore é 500 operações por lote; sobra margem para incrementos. */
const BATCH_LIMIT = 400;

const codeOf = (error: unknown) => String((error as { code?: unknown }).code ?? '');

/** Traduz erros do Firestore para os códigos que a web conhece. */
export function firestoreError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const code = codeOf(error);
  const message = (error as Error).message ?? String(error);
  if (code === 'permission-denied') return new AppError('FORBIDDEN', message);
  if (code === 'not-found') return new AppError('NOT_FOUND', message);
  if (code === 'unavailable' || code === 'deadline-exceeded') return new AppError('NETWORK', message);
  // Consulta que precisa de índice composto ainda não criado (firestore.indexes.json).
  if (code === 'failed-precondition') return new AppError('FIRESTORE_INDEX', message);
  if (code === 'resource-exhausted') return new AppError('QUOTA', message);
  return new AppError('UNKNOWN', message);
}

/** Traduz erros do Firebase Auth. */
export function authError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const code = codeOf(error);
  const message = (error as Error).message ?? String(error);
  switch (code) {
    case 'auth/email-already-in-use':
      return new AppError('EMAIL_TAKEN', message);
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return new AppError('INVALID_CREDENTIALS', message);
    case 'auth/weak-password':
      return new AppError('WEAK_PASSWORD', message);
    case 'auth/too-many-requests':
      return new AppError('TOO_MANY_REQUESTS', message);
    case 'auth/network-request-failed':
      return new AppError('NETWORK', message);
    // Janela do Google fechada ou trocada por outra: não é erro para mostrar.
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return new AppError('GOOGLE_CANCELLED', message);
    // O domínio do site não está em Authentication, Configurações, Domínios autorizados.
    case 'auth/unauthorized-domain':
      return new AppError('AUTH_DOMAIN_UNAUTHORIZED', message);
    // Mesmo e-mail já cadastrado com senha (o Firebase guarda uma conta por e-mail).
    case 'auth/account-exists-with-different-credential':
      return new AppError('ACCOUNT_EXISTS_OTHER_METHOD', message);
    // Login por e-mail e senha não foi ativado no console do Firebase, ou o Authentication
    // nunca foi iniciado no projeto (configuration-not-found).
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
    case 'auth/configuration-not-found':
      return new AppError('AUTH_DISABLED', message);
    default:
      return new AppError('UNKNOWN', message);
  }
}

function toFirestoreValue(value: unknown): unknown {
  if (value instanceof Increment) return increment(value.by);
  if (value instanceof ArrayUnion) return arrayUnion(...value.values);
  if (value instanceof ArrayRemove) return arrayRemove(...value.values);
  return value;
}

const toFirestoreData = (data: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]));

export class FirestoreStore implements DocStore {
  readonly mode = 'firebase' as const;

  constructor(private readonly db: Firestore) {}

  newId(): string {
    return randomId();
  }

  async get<T>(path: string, id: string): Promise<T | null> {
    try {
      const snapshot = await getDoc(doc(this.db, path, id));
      return snapshot.exists() ? (snapshot.data() as T) : null;
    } catch (error) {
      throw firestoreError(error);
    }
  }

  async list<T>(path: string, filters: Filter[] = []): Promise<T[]> {
    try {
      const constraints = filters.map((filter) => where(filter.field, filter.op, filter.value));
      const snapshot = await getDocs(query(collection(this.db, path), ...constraints));
      return snapshot.docs.map((item) => item.data() as T);
    } catch (error) {
      throw firestoreError(error);
    }
  }

  async commit(ops: WriteOp[]): Promise<void> {
    // Acima do limite o lote é dividido: cada parte é atômica, o todo não. Só a
    // demonstração e exclusões muito grandes chegam a esse tamanho.
    for (let index = 0; index < ops.length; index += BATCH_LIMIT) {
      const batch = writeBatch(this.db);
      for (const op of ops.slice(index, index + BATCH_LIMIT)) {
        const ref = doc(this.db, op.path, op.id);
        if (op.type === 'delete') batch.delete(ref);
        else if (op.type === 'set') batch.set(ref, toFirestoreData(op.data));
        else batch.update(ref, toFirestoreData(op.data));
      }
      try {
        await batch.commit();
      } catch (error) {
        throw firestoreError(error);
      }
    }
  }
}

/** Como abrir o login do Google (os testes trocam por uma credencial do emulador). */
export type GoogleSignIn = (auth: Auth) => Promise<UserCredential>;

/**
 * Janela do Google (pop-up). Onde não há janela (pop-up bloqueado, app instalado em
 * alguns celulares), segue por redirecionamento: a página sai e, na volta, o SDK
 * conclui a entrada sozinho na abertura (authStateReady).
 */
const popupOrRedirect: GoogleSignIn = async (auth) => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    const code = codeOf(error);
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      return signInWithRedirect(auth, provider);
    }
    throw error;
  }
};

export class FirebaseAuthGateway implements AuthGateway {
  // Trocar e-mail no Firebase exige confirmação pelo próprio e-mail (fora do escopo).
  readonly canChangeEmail = false;
  readonly canUseGoogle = true;

  constructor(
    private readonly auth: Auth,
    private readonly googleSignIn: GoogleSignIn = popupOrRedirect,
  ) {}

  currentUid(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }

  currentEmail(): string | null {
    return this.auth.currentUser?.email ?? null;
  }

  currentName(): string | null {
    return this.auth.currentUser?.displayName ?? null;
  }

  hasPassword(): boolean {
    return this.auth.currentUser?.providerData.some((info) => info.providerId === 'password') ?? false;
  }

  async signInWithGoogle(): Promise<string> {
    try {
      return (await this.googleSignIn(this.auth)).user.uid;
    } catch (error) {
      throw authError(error);
    }
  }

  async signUp(email: string, password: string): Promise<string> {
    try {
      return (await createUserWithEmailAndPassword(this.auth, email, password)).user.uid;
    } catch (error) {
      throw authError(error);
    }
  }

  async signIn(email: string, password: string): Promise<string> {
    try {
      return (await signInWithEmailAndPassword(this.auth, email, password)).user.uid;
    } catch (error) {
      throw authError(error);
    }
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user?.email) throw new AppError('UNAUTHORIZED', 'Sessão inválida');
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
    } catch (error) {
      const mapped = authError(error);
      throw mapped.code === 'INVALID_CREDENTIALS' ? new AppError('WRONG_PASSWORD', 'Senha atual incorreta') : mapped;
    }
    try {
      await updatePassword(user, newPassword);
    } catch (error) {
      throw authError(error);
    }
  }

  async changeEmail(): Promise<void> {
    throw badRequest('EMAIL_CHANGE_UNSUPPORTED', 'Troca de e-mail indisponível');
  }

  onChange(listener: (uid: string | null) => void): () => void {
    return onAuthStateChanged(this.auth, (user) => listener(user?.uid ?? null));
  }
}

export interface FirebaseConnectOptions {
  /** Nome do app do SDK; os testes abrem vários (uma pessoa por app). */
  appName?: string;
  /** Tempo máximo para o Firestore responder antes de cair no modo local. */
  timeoutMs?: number;
  emulator?: { host: string; firestorePort: number; authPort: number };
  /** Desiste da conexão (por exemplo, quando a checagem rápida já achou o motivo). */
  signal?: AbortSignal;
  /** Login do Google (padrão: pop-up com redirecionamento de reserva). */
  googleSignIn?: GoogleSignIn;
}

export interface FirebaseConnection {
  store: FirestoreStore;
  auth: FirebaseAuthGateway;
  dispose(): Promise<void>;
}

/**
 * Abre o Firebase e confirma que o Firestore responde. Qualquer resposta do servidor
 * serve, inclusive "sem permissão" (ninguém logado ainda); falha de rede, projeto
 * inexistente ou demora acima do limite fazem a promessa rejeitar.
 */
export async function connectFirebase(
  config: FirebaseOptions,
  options: FirebaseConnectOptions = {},
): Promise<FirebaseConnection> {
  const app = options.appName ? initializeApp(config, options.appName) : initializeApp(config);
  try {
    const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
    const auth = getAuth(app);
    if (options.emulator) {
      const { host, firestorePort, authPort } = options.emulator;
      connectFirestoreEmulator(db, host, firestorePort);
      connectAuthEmulator(auth, `http://${host}:${authPort}`, { disableWarnings: true });
    }
    await probe(db, options.timeoutMs ?? 8000, options.signal);
    await auth.authStateReady();
    return {
      store: new FirestoreStore(db),
      auth: new FirebaseAuthGateway(auth, options.googleSignIn),
      dispose: () => deleteApp(app),
    };
  } catch (error) {
    await deleteApp(app).catch(() => undefined);
    throw error;
  }
}

async function probe(db: Firestore, timeoutMs: number, signal?: AbortSignal): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stop: (() => void) | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AppError('NETWORK', `Firestore sem resposta em ${timeoutMs} ms`)), timeoutMs);
    stop = () => reject(new AppError('NETWORK', 'Conexão com o Firestore cancelada'));
    if (signal?.aborted) stop();
    signal?.addEventListener('abort', stop);
  });
  try {
    await Promise.race([getDocFromServer(doc(db, '_probe', 'ping')), timeout]);
  } catch (error) {
    if (codeOf(error) === 'permission-denied') return;
    throw error instanceof AppError ? error : firestoreError(error);
  } finally {
    clearTimeout(timer);
    if (stop) signal?.removeEventListener('abort', stop);
  }
}
