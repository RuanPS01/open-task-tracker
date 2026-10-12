import { PROJECT_COLORS, type Id, type User, type UserPreferences } from '@ott/shared';
import type { UserDoc } from '../store/schema';

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  locale: 'pt-BR',
  weekStart: 1,
  timeFormat: '24h',
  durationFormat: 'improved',
  timezone: 'America/Sao_Paulo',
};

/** Cor de avatar estável a partir do e-mail, para a mesma pessoa ter sempre a mesma cor. */
export function avatarColorFor(email: string): string {
  let hash = 0;
  for (const char of email) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PROJECT_COLORS[hash % PROJECT_COLORS.length]!;
}

export function newUserDoc(
  id: Id,
  input: { name: string; email: string; preferences?: Partial<UserPreferences> },
  createdAt: string,
): UserDoc {
  return {
    id,
    name: input.name,
    email: input.email,
    avatarColor: avatarColorFor(input.email),
    currentWorkspaceId: null,
    preferences: { ...DEFAULT_PREFERENCES, ...input.preferences },
    pinnedProjectIds: [],
    runningEntry: null,
    createdAt,
  };
}

export function toUser(doc: UserDoc): User {
  return {
    id: doc.id,
    name: doc.name,
    email: doc.email,
    avatarColor: doc.avatarColor,
    currentWorkspaceId: doc.currentWorkspaceId,
    // Preferência nova que ainda não estava salva cai no padrão.
    preferences: { ...DEFAULT_PREFERENCES, ...doc.preferences },
    createdAt: doc.createdAt,
  };
}
