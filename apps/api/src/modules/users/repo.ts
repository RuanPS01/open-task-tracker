import { PROJECT_COLORS, type User, type UserPreferences } from '@ott/shared';
import { nowIso, type Db } from '../../db/database';

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  avatar_color: string;
  current_workspace_id: number | null;
  preferences: string;
  created_at: string;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  locale: 'pt-BR',
  weekStart: 1,
  timeFormat: '24h',
  durationFormat: 'improved',
  timezone: 'America/Sao_Paulo',
};

export function toUser(row: UserRow): User {
  let stored: Partial<UserPreferences> = {};
  try {
    stored = JSON.parse(row.preferences) as Partial<UserPreferences>;
  } catch {
    // Preferência corrompida não pode impedir o login: volta ao padrão.
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarColor: row.avatar_color,
    currentWorkspaceId: row.current_workspace_id,
    preferences: { ...DEFAULT_PREFERENCES, ...stored },
    createdAt: row.created_at,
  };
}

export function findUserById(db: Db, id: number): UserRow | undefined {
  return db.get<UserRow>('SELECT * FROM users WHERE id = ?', id);
}

export function findUserByEmail(db: Db, email: string): UserRow | undefined {
  return db.get<UserRow>('SELECT * FROM users WHERE email = ?', email);
}

/** Cor de avatar estável a partir do e-mail, para a mesma pessoa ter sempre a mesma cor. */
export function avatarColorFor(email: string): string {
  let hash = 0;
  for (const char of email) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PROJECT_COLORS[hash % PROJECT_COLORS.length]!;
}

export function insertUser(
  db: Db,
  input: { name: string; email: string; passwordHash: string; preferences?: Partial<UserPreferences> },
): UserRow {
  const { lastInsertRowid } = db.run(
    `INSERT INTO users (name, email, password_hash, avatar_color, preferences, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    input.name,
    input.email,
    input.passwordHash,
    avatarColorFor(input.email),
    JSON.stringify({ ...DEFAULT_PREFERENCES, ...input.preferences }),
    nowIso(),
  );
  return findUserById(db, lastInsertRowid)!;
}

export function updateUser(
  db: Db,
  id: number,
  changes: { name?: string; email?: string; preferences?: UserPreferences; passwordHash?: string },
): void {
  if (changes.name !== undefined) db.run('UPDATE users SET name = ? WHERE id = ?', changes.name, id);
  if (changes.email !== undefined) db.run('UPDATE users SET email = ? WHERE id = ?', changes.email, id);
  if (changes.preferences !== undefined) {
    db.run('UPDATE users SET preferences = ? WHERE id = ?', JSON.stringify(changes.preferences), id);
  }
  if (changes.passwordHash !== undefined) {
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', changes.passwordHash, id);
  }
}

export function setCurrentWorkspace(db: Db, userId: number, workspaceId: number | null): void {
  db.run('UPDATE users SET current_workspace_id = ? WHERE id = ?', workspaceId, userId);
}
