// Contas do modo local. Ficam no mesmo lowdb dos dados, com a senha guardada como
// PBKDF2 (Web Crypto). Quem tem acesso ao navegador tem acesso aos dados de qualquer
// forma: a senha aqui separa pessoas que dividem o computador, não protege segredo.
import type { LowSync } from 'lowdb';
import { AppError, conflict } from '../errors';
import { randomId } from '../store/types';
import type { LocalAccount, LocalData } from '../store/local';
import type { AuthGateway } from './types';

const ITERATIONS = 100_000;

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

async function hashPassword(password: string): Promise<Pick<LocalAccount, 'salt' | 'hash' | 'iterations'>> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toBase64(salt), hash: await derive(password, salt, ITERATIONS), iterations: ITERATIONS };
}

async function verifyPassword(password: string, account: LocalAccount): Promise<boolean> {
  return (await derive(password, fromBase64(account.salt), account.iterations)) === account.hash;
}

const invalidCredentials = () => new AppError('INVALID_CREDENTIALS', 'E-mail ou senha incorretos');

export class LocalAuth implements AuthGateway {
  readonly canChangeEmail = true;
  private readonly listeners = new Set<(uid: string | null) => void>();

  constructor(private readonly db: LowSync<LocalData>) {}

  private accountByUid(uid: string): LocalAccount | undefined {
    return Object.values(this.db.data.accounts).find((account) => account.uid === uid);
  }

  private setSession(uid: string | null): void {
    this.db.read();
    this.db.data.sessionUid = uid;
    this.db.write();
    for (const listener of this.listeners) listener(uid);
  }

  currentUid(): string | null {
    const uid = this.db.data.sessionUid;
    // Sessão de uma conta que não existe mais (dados apagados em outra aba): ignora.
    return uid && this.accountByUid(uid) ? uid : null;
  }

  currentEmail(): string | null {
    const uid = this.currentUid();
    return uid ? (this.accountByUid(uid)?.email ?? null) : null;
  }

  async signUp(email: string, password: string): Promise<string> {
    const key = email.toLowerCase();
    this.db.read();
    if (this.db.data.accounts[key]) throw conflict('EMAIL_TAKEN', 'E-mail já cadastrado');
    const uid = randomId(28);
    this.db.data.accounts[key] = { uid, email: key, ...(await hashPassword(password)) };
    this.db.write();
    this.setSession(uid);
    return uid;
  }

  async signIn(email: string, password: string): Promise<string> {
    this.db.read();
    const account = this.db.data.accounts[email.toLowerCase()];
    // Mesma resposta para e-mail inexistente e senha errada: não revela quem tem conta.
    if (!account || !(await verifyPassword(password, account))) throw invalidCredentials();
    this.setSession(account.uid);
    return account.uid;
  }

  async signOut(): Promise<void> {
    this.setSession(null);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const uid = this.currentUid();
    const account = uid ? this.accountByUid(uid) : undefined;
    if (!account) throw new AppError('UNAUTHORIZED', 'Sessão inválida');
    if (!(await verifyPassword(currentPassword, account))) {
      throw new AppError('WRONG_PASSWORD', 'Senha atual incorreta');
    }
    const next = await hashPassword(newPassword);
    this.db.read();
    const stored = this.db.data.accounts[account.email];
    if (stored) Object.assign(stored, next);
    this.db.write();
  }

  async changeEmail(newEmail: string): Promise<void> {
    const uid = this.currentUid();
    const account = uid ? this.accountByUid(uid) : undefined;
    if (!account) throw new AppError('UNAUTHORIZED', 'Sessão inválida');
    const key = newEmail.toLowerCase();
    if (key === account.email) return;
    this.db.read();
    if (this.db.data.accounts[key]) throw conflict('EMAIL_TAKEN', 'E-mail já cadastrado');
    delete this.db.data.accounts[account.email];
    this.db.data.accounts[key] = { ...account, email: key };
    this.db.write();
  }

  onChange(listener: (uid: string | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
