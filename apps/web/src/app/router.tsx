import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthPage } from '../features/auth/AuthPage';
import { InvitePage } from '../features/auth/InvitePage';
import { ClientsPage } from '../features/manage/ClientsPage';
import { MembersPage } from '../features/manage/MembersPage';
import { TagsPage } from '../features/manage/TagsPage';
import { ProjectPage } from '../features/projects/ProjectPage';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { ProfileSettingsPage } from '../features/settings/ProfileSettingsPage';
import { WorkspaceSettingsPage } from '../features/settings/WorkspaceSettingsPage';
import { TasksPage } from '../features/tasks/TasksPage';
import { TimelinePage } from '../features/timeline/TimelinePage';
import { TimerPage } from '../features/timer/TimerPage';
import { AuthGate, PublicOnly, RequireLogin } from './AuthGate';
import { RootLayout } from './RootLayout';

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
          { path: '/reports', element: <ReportsPage /> },
          { path: '/projects', element: <ProjectsPage /> },
          { path: '/projects/:projectId/:tab?', element: <ProjectPage /> },
          { path: '/tasks', element: <TasksPage /> },
          { path: '/timeline', element: <TimelinePage /> },
          { path: '/members', element: <MembersPage /> },
          { path: '/clients', element: <ClientsPage /> },
          { path: '/tags', element: <TagsPage /> },
          { path: '/settings/profile', element: <ProfileSettingsPage /> },
          { path: '/settings/workspace', element: <WorkspaceSettingsPage /> },
          { path: '*', element: <Navigate to="/timer" replace /> },
        ],
      },
    ],
  },
], { basename });
