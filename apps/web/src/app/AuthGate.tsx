import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSessionQuery } from '../data/session';
import { LoadingBlock } from '../components/ui/EmptyState';
import { NoWorkspace } from '../features/settings/NoWorkspace';
import { AppShell } from '../layout/AppShell';
import { SessionProvider } from './session';

/** Protege as rotas internas: sem sessão, manda para o login guardando o destino. */
export function AuthGate() {
  const { data: session, isLoading } = useSessionQuery();
  const location = useLocation();

  if (isLoading) return <LoadingBlock />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  const workspace =
    session.workspaces.find((w) => w.id === session.user.currentWorkspaceId) ?? session.workspaces[0];
  if (!workspace) return <NoWorkspace />;

  return (
    <SessionProvider value={{ user: session.user, workspace, workspaces: session.workspaces }}>
      <AppShell key={workspace.id}>
        <Outlet />
      </AppShell>
    </SessionProvider>
  );
}

/** Exige login, mas não um workspace (página de convite, que é como a pessoa entra num). */
export function RequireLogin() {
  const { data: session, isLoading } = useSessionQuery();
  const location = useLocation();
  if (isLoading) return <LoadingBlock />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

export function PublicOnly() {
  const { data: session, isLoading } = useSessionQuery();
  const location = useLocation();
  if (isLoading) return <LoadingBlock />;
  if (session) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/timer'} replace />;
  }
  return <Outlet />;
}
