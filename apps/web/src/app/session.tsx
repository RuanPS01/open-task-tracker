// Sessão já carregada (usuário, workspace atual e lista de workspaces).
// Só existe dentro do AuthGate, então os componentes podem assumir login feito.
import type { Id, User, UserPreferences, Workspace } from '@ott/shared';
import { createContext, useContext, type ReactNode } from 'react';

export interface SessionValue {
  user: User;
  workspace: Workspace;
  workspaces: Workspace[];
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ value, children }: { value: SessionValue; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession fora do SessionProvider');
  return value;
}

export const useWorkspace = (): Workspace => useSession().workspace;
export const useWorkspaceId = (): Id => useSession().workspace.id;
export const useCurrentUser = (): User => useSession().user;
export const usePreferences = (): UserPreferences => useSession().user.preferences;
export const useIsAdmin = (): boolean => useSession().workspace.role === 'admin';
