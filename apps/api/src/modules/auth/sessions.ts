// Sessões opacas em cookie httpOnly. O banco guarda só o SHA-256 do token, então um
// vazamento do arquivo SQLite não entrega sessões válidas.
import { createHash, randomBytes } from 'node:crypto';
import { nowIso, type Db } from '../../db/database';

export const SESSION_COOKIE = 'ott_session';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function createSession(db: Db, userId: number, days: number): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  db.run(
    'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    hashToken(token),
    userId,
    nowIso(),
    expiresAt.toISOString(),
  );
  return { token, expiresAt };
}

export function findSessionUserId(db: Db, token: string): number | null {
  const row = db.get<{ user_id: number; expires_at: string }>(
    'SELECT user_id, expires_at FROM sessions WHERE id = ?',
    hashToken(token),
  );
  if (!row) return null;
  if (row.expires_at < nowIso()) {
    db.run('DELETE FROM sessions WHERE id = ?', hashToken(token));
    return null;
  }
  return row.user_id;
}

export function deleteSession(db: Db, token: string): void {
  db.run('DELETE FROM sessions WHERE id = ?', hashToken(token));
}

export function deleteOtherSessions(db: Db, userId: number, keepToken: string): void {
  db.run('DELETE FROM sessions WHERE user_id = ? AND id <> ?', userId, hashToken(keepToken));
}

export function purgeExpiredSessions(db: Db): void {
  db.run('DELETE FROM sessions WHERE expires_at < ?', nowIso());
}
