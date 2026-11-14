import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoadingBlock } from '../components/ui/EmptyState';
import { AuthPage } from '../features/auth/AuthPage';
import { InvitePage } from '../features/auth/InvitePage';
import { ProjectPage } from '../features/projects/ProjectPage';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { TasksPage } from '../features/tasks/TasksPage';
import { TimelinePage } from '../features/timeline/TimelinePage';
import { TimerPage } from '../features/timer/TimerPage';
import { AuthGate, PublicOnly, RequireLogin } from './AuthGate';
import { RootLayout } from './RootLayout';

// Telas de uso menos frequente (Relatórios, Gestão e Configurações) vêm em pedaços
// separados do build, baixados ao abrir a rota: o pacote principal fica com o que a
// abertura e o dia a dia usam (Cronômetro, Tarefas, Projetos, Gantt, Linha do tempo).
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  const Page = lazy(async (): Promise<{ default: ComponentType }> => ({ default: (await load())[name] }));
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Page />
    </Suspense>
  );
}

// No GitHub Pages o app fica num subcaminho (/nome-do-repositorio/): o Vite informa em BASE_URL.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          { path: '/login', element: <AuthPage mode="login" /> },
          { path: '/signup', element: <AuthPage mode="signup" /> },
        ],
      },
      {
        element: <RequireLogin />,
        children: [{ path: '/invite/:workspaceId/:inviteId', element: <InvitePage /> }],
      },
      {
        element: <AuthGate />,
        children: [
          { index: true, element: <Navigate to="/timer" replace /> },
          { path: '/timer', element: <TimerPage /> },
          { path: '/reports', element: page(() => import('../features/reports/ReportsPage'), 'ReportsPage') },
          { path: '/projects', element: <ProjectsPage /> },
          { path: '/projects/:projectId/:tab?', element: <ProjectPage /> },
          { path: '/tasks', element: <TasksPage /> },
          { path: '/timeline', element: <TimelinePage /> },
          { path: '/members', element: page(() => import('../features/manage/MembersPage'), 'MembersPage') },
          { path: '/clients', element: page(() => import('../features/manage/ClientsPage'), 'ClientsPage') },
          { path: '/tags', element: page(() => import('../features/manage/TagsPage'), 'TagsPage') },
          { path: '/settings/profile', element: page(() => import('../features/settings/ProfileSettingsPage'), 'ProfileSettingsPage') },
          { path: '/settings/workspace', element: page(() => import('../features/settings/WorkspaceSettingsPage'), 'WorkspaceSettingsPage') },
          { path: '*', element: <Navigate to="/timer" replace /> },
        ],
      },
    ],
  },
], { basename });
