// Contrato de autenticação por e-mail e senha. Firebase Auth no modo Firebase;
// contas guardadas no próprio lowdb no modo local.

export interface AuthGateway {
  /** Troca de e-mail direta só existe no modo local (no Firebase exige confirmação por e-mail). */
  readonly canChangeEmail: boolean;
  currentUid(): string | null;
  currentEmail(): string | null;
  /** Cria a conta e já entra com ela. Devolve o uid. */
  signUp(email: string, password: string): Promise<string>;
  signIn(email: string, password: string): Promise<string>;
  signOut(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  changeEmail(newEmail: string): Promise<void>;
  /** Avisa quando a pessoa entra ou sai (inclusive por outra aba ou por expiração). */
  onChange(listener: (uid: string | null) => void): () => void;
}
