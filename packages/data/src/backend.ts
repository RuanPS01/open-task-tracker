// Fachada usada pela web: as mesmas operações nos dois modos. Cada grupo corresponde
// a um conjunto de rotas da antiga API HTTP (sessão, tarefas, apontamentos...).
import type { Id, Locale, ReportQueryInput, SessionResponse } from '@ott/shared';
import type { AuthGateway } from './auth/types';
import { badRequest } from './errors';
import * as catalog from './services/catalog';
import type { Ctx } from './services/context';
import { DEMO_EMAIL, DEMO_NAME, DEMO_PASSWORD, DEMO_WORKSPACE, seedDemoWorkspace } from './services/demo';
import * as members from './services/members';
import * as projects from './services/projects';
import * as reports from './services/reports';
import * as session from './services/session';
import * as tasks from './services/tasks';
import * as timeEntries from './services/timeEntries';
import * as workspaces from './services/workspaces';
import type { DataMode, DocStore } from './store/types';

/** Por que o modo local está em uso, quando não foi escolha explícita. */
export type FallbackReason = 'not-configured' | 'unreachable' | 'forced-local';

export interface BackendOptions {
  store: DocStore;
  auth: AuthGateway;
  now?: () => Date;
  fallbackReason?: FallbackReason | null;
  /** Detalhe técnico do motivo (mensagem de erro do Firebase), para o aviso na tela. */
  fallbackDetail?: string | null;
  /** Relê dados gravados por outra aba (só modo local). */
  reload?: () => void;
}

export function createBackend(options: BackendOptions) {
  const ctx: Ctx = { store: options.store, auth: options.auth, now: options.now ?? (() => new Date()) };
  const fn =
    <A extends unknown[], R>(service: (ctx: Ctx, ...args: A) => R) =>
    (...args: A) =>
      service(ctx, ...args);

  return {
    mode: options.store.mode as DataMode,
    fallbackReason: options.fallbackReason ?? null,
    fallbackDetail: options.fallbackDetail ?? null,
    canChangeEmail: options.auth.canChangeEmail,
    onAuthChange: (listener: (uid: string | null) => void) => options.auth.onChange(listener),
    reload: () => options.reload?.(),

    session: {
      get: fn(session.getSession),
      signup: fn(session.signup),
      login: fn(session.login),
      logout: fn(session.logout),
      updateProfile: fn(session.updateProfile),
      changePassword: fn(session.changePassword),
      switchWorkspace: (workspaceId: Id) => session.switchWorkspace(ctx, { workspaceId }),
      runningTimer: fn(session.runningTimer),
      /** Modo local: entra (ou cria) a conta de demonstração com o workspace de exemplo. */
      startDemo: async (): Promise<SessionResponse> => {
        if (options.store.mode !== 'local') throw badRequest('DEMO_LOCAL_ONLY', 'Demonstração só no modo local');
        try {
          return await session.login(ctx, { email: DEMO_EMAIL, password: DEMO_PASSWORD });
        } catch (error) {
          if ((error as { code?: string }).code !== 'INVALID_CREDENTIALS') throw error;
        }
        const created = await session.signup(ctx, {
          name: DEMO_NAME,
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          workspaceName: DEMO_WORKSPACE,
          locale: 'pt-BR',
          timezone: 'America/Sao_Paulo',
        });
        await seedDemoWorkspace(ctx, created.workspaces[0]!.id);
        return (await session.getSession(ctx))!;
      },
    },
    workspaces: {
      create: (name: string, options?: { demo?: boolean }) => workspaces.createWorkspace(ctx, { name }, options),
      update: fn(workspaces.updateWorkspace),
    },
    members: {
      list: fn(members.listMembers),
      update: fn(members.updateMember),
      remove: fn(members.removeMember),
      listInvites: fn(members.listInvites),
      createInvite: fn(members.createInvite),
      revokeInvite: fn(members.revokeInvite),
      getInvite: fn(members.getInvite),
      acceptInvite: fn(members.acceptInvite),
    },
    clients: {
      list: fn(catalog.listClients),
      create: fn(catalog.createClient),
      update: fn(catalog.updateClient),
      remove: fn(catalog.removeClient),
    },
    tags: {
      list: fn(catalog.listTags),
      create: (workspaceId: Id, name: string) => catalog.createTag(ctx, workspaceId, { name }),
      rename: (workspaceId: Id, id: Id, name: string) => catalog.renameTag(ctx, workspaceId, id, { name }),
      remove: fn(catalog.removeTag),
    },
    holidays: {
      list: fn(catalog.listHolidays),
      create: fn(catalog.createHoliday),
      importNational: fn(catalog.importHolidays),
      remove: fn(catalog.removeHoliday),
    },
    projects: {
      list: fn(projects.listProjects),
      create: fn(projects.createProject),
      update: fn(projects.updateProject),
      remove: fn(projects.removeProject),
    },
    tasks: {
      list: fn(tasks.listTasks),
      create: fn(tasks.createTask),
      update: fn(tasks.updateTask),
      schedule: fn(tasks.scheduleTasks),
      remove: fn(tasks.removeTask),
    },
    dependencies: {
      list: fn(tasks.listDependencies),
      create: fn(tasks.createDependency),
      update: fn(tasks.updateDependency),
      remove: fn(tasks.removeDependency),
    },
    timeEntries: {
      list: (workspaceId: Id, from: string, to: string) => timeEntries.listTimeEntries(ctx, workspaceId, { from, to }),
      start: fn(timeEntries.startTimer),
      create: fn(timeEntries.createTimeEntry),
      update: fn(timeEntries.updateTimeEntry),
      stop: fn(timeEntries.stopTimeEntry),
      remove: fn(timeEntries.removeTimeEntry),
    },
    reports: {
      summary: fn(reports.summaryReport),
      detailed: fn(reports.detailedReport),
      csv: (workspaceId: Id, query: ReportQueryInput, locale: Locale) => reports.detailedCsv(ctx, workspaceId, query, locale),
    },
  };
}

export type Backend = ReturnType<typeof createBackend>;
