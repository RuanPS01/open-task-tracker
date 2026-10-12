// Contrato de autenticação: e-mail e senha nos dois modos e Google só no modo Firebase.
// Firebase Auth no modo Firebase; contas guardadas no próprio lowdb no modo local.

export interface AuthGateway {
  /** Troca de e-mail direta só existe no modo local (no Firebase exige confirmação por e-mail). */
  readonly canChangeEmail: boolean;
  currentUid(): string | null;
  currentEmail(): string | null;
  /** Nome que veio do provedor de login (Google), quando houver. */
  currentName(): string | null;
  /** A conta tem senha (quem entrou só pelo Google não tem senha para trocar). */
  hasPassword(): boolean;
  /** Entrar pelo Google existe só no modo Firebase. */
  readonly canUseGoogle: boolean;
  /** Entra pelo Google (cria a conta de login na primeira vez). Devolve o uid. */
  signInWithGoogle(): Promise<string>;
  /** Cria a conta e já entra com ela. Devolve o uid. */
  signUp(email: string, password: string): Promise<string>;
  signIn(email: string, password: string): Promise<string>;
  signOut(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  changeEmail(newEmail: string): Promise<void>;
  /** Avisa quando a pessoa entra ou sai (inclusive por outra aba ou por expiração). */
  onChange(listener: (uid: string | null) => void): () => void;
}
