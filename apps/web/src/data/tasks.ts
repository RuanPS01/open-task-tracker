import {
  effectiveStatusKey,
  planBoardMove,
  type CreateDependencyInput,
  type CreateTaskInput,
  type CustomStatus,
  type Id,
  type MoveTaskInput,
  type ScheduleTasksInput,
  type Task,
  type TaskDependency,
  type UpdateDependencyInput,
  type UpdateTaskInput,
} from '@ott/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '../app/session';
import { backend } from './backend';
import { keys } from './keys';

// O workspace inteiro de tarefas fica num só cache: Lista, Quadro, Gantt e Linha do
// tempo leem a mesma fonte e nunca mostram versões diferentes da mesma tarefa.
export function useTasks() {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.tasks(wid),
    queryFn: () => backend().tasks.list(wid),
    staleTime: 15_000,
  });
}

export function useDependencies() {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.dependencies(wid),
    queryFn: () => backend().dependencies.list(wid),
    staleTime: 15_000,
  });
}

function invalidateTaskData(client: QueryClient, wid: Id) {
  void client.invalidateQueries({ queryKey: keys.tasks(wid) });
  void client.invalidateQueries({ queryKey: keys.projects(wid) });
}

function patchTasks(client: QueryClient, wid: Id, changes: Map<Id, Partial<Task>>) {
  client.setQueryData<Task[]>(keys.tasks(wid), (list) =>
    list?.map((task) => {
      const change = changes.get(task.id);
      return change ? { ...task, ...change } : task;
    }),
  );
}

export function useCreateTask() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => backend().tasks.create(wid, input),
    onSuccess: (task) => {
      client.setQueryData<Task[]>(keys.tasks(wid), (list) => (list ? [...list, task] : list));
      invalidateTaskData(client, wid);
    },
  });
}

export function useUpdateTask() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateTaskInput & { id: Id }) => backend().tasks.update(wid, id, input),
    onMutate: async ({ id, ...input }) => {
      await client.cancelQueries({ queryKey: keys.tasks(wid) });
      const previous = client.getQueryData<Task[]>(keys.tasks(wid));
      // Só a categoria volta ao status padrão dela (a camada de dados faz o mesmo).
      const patch: Partial<Task> = input.status !== undefined && input.statusId === undefined ? { ...input, statusId: null } : { ...input };
      // Status trocado fora do Quadro leva o cartão para o fim da coluna nova (como no serviço).
      const current = previous?.find((task) => task.id === id);
      if (current && (input.status !== undefined || input.statusId !== undefined)) {
        const nextKey = patch.statusId ?? patch.status ?? current.status;
        if (nextKey !== (current.statusId ?? current.status)) patch.boardPosition = null;
      }
      patchTasks(client, wid, new Map([[id, patch]]));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) client.setQueryData(keys.tasks(wid), context.previous);
    },
    onSettled: () => invalidateTaskData(client, wid),
  });
}

/** Lote de datas do Gantt e da Linha do tempo, com atualização otimista. */
export function useScheduleTasks() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: ScheduleTasksInput) => backend().tasks.schedule(wid, input),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: keys.tasks(wid) });
      const previous = client.getQueryData<Task[]>(keys.tasks(wid));
      patchTasks(client, wid, new Map(input.updates.map(({ id, ...dates }) => [id, dates])));
      return { previous };
    },
    onSuccess: ({ tasks }) => patchTasks(client, wid, new Map(tasks.map((task) => [task.id, task]))),
    onError: (_error, _input, context) => {
      if (context?.previous) client.setQueryData(keys.tasks(wid), context.previous);
    },
    onSettled: () => invalidateTaskData(client, wid),
  });
}

/**
 * Arraste de cartão no Quadro. A prévia otimista usa o mesmo `planBoardMove` da camada de
 * dados, então o cartão já fica no lugar certo antes da resposta; a resposta traz o que
 * mudou de fato (vizinhos que ganharam posição, status da tarefa-mãe).
 */
export function useMoveTask() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, ...input }: MoveTaskInput & { id: Id }) => backend().tasks.move(wid, id, input),
    onMutate: async ({ id, afterId, status, statusId }) => {
      await client.cancelQueries({ queryKey: keys.tasks(wid) });
      const previous = client.getQueryData<Task[]>(keys.tasks(wid));
      const task = previous?.find((item) => item.id === id);
      if (!previous || !task) return { previous };
      const statuses = client.getQueryData<CustomStatus[]>(keys.statuses(wid)) ?? [];
      const custom = statusId ? statuses.find((item) => item.id === statusId) : undefined;
      const moved: Task = custom
        ? { ...task, status: custom.category, statusId: custom.id }
        : status !== undefined || statusId === null
          ? { ...task, status: status ?? task.status, statusId: null }
          : task;
      const known = new Set(statuses.map((item) => item.id));
      const key = effectiveStatusKey(moved, known);
      const column = previous.filter((item) => item.id !== id && effectiveStatusKey(item, known) === key);
      const changes = new Map<Id, Partial<Task>>();
      for (const [taskId, boardPosition] of planBoardMove(column, id, afterId)) changes.set(taskId, { boardPosition });
      changes.set(id, { ...changes.get(id), status: moved.status, statusId: moved.statusId });
      patchTasks(client, wid, changes);
      return { previous };
    },
    onSuccess: ({ tasks }) => patchTasks(client, wid, new Map(tasks.map((task) => [task.id, task]))),
    onError: (_error, _input, context) => {
      if (context?.previous) client.setQueryData(keys.tasks(wid), context.previous);
    },
    onSettled: () => invalidateTaskData(client, wid),
  });
}

export function useDeleteTask() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (id: Id) => backend().tasks.remove(wid, id),
    onSuccess: () => {
      invalidateTaskData(client, wid);
      void client.invalidateQueries({ queryKey: keys.dependencies(wid) });
    },
  });
}

export function useCreateDependency() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: CreateDependencyInput) => backend().dependencies.create(wid, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.dependencies(wid) });
      invalidateTaskData(client, wid);
    },
  });
}

export function useUpdateDependency() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateDependencyInput & { id: Id }) => backend().dependencies.update(wid, id, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.dependencies(wid) });
      invalidateTaskData(client, wid);
    },
  });
}

export function useDeleteDependency() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (id: Id) => backend().dependencies.remove(wid, id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: keys.dependencies(wid) });
      const previous = client.getQueryData<TaskDependency[]>(keys.dependencies(wid));
      client.setQueryData<TaskDependency[]>(keys.dependencies(wid), (list) => list?.filter((dep) => dep.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) client.setQueryData(keys.dependencies(wid), context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.dependencies(wid) }),
  });
}

// --- Importação por JSON -------------------------------------------------------

export interface TaskImportRequest {
  text: string;
  /** Projeto da tela de onde se importa (Gantt ou tarefas do projeto). */
  defaultProjectId: Id | null;
}

/** Revisão da importação: não grava nada. Erros de rede aparecem no próprio diálogo. */
export function usePreviewTaskImport() {
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: ({ text, defaultProjectId }: TaskImportRequest) =>
      backend().tasks.previewImport(wid, text, { defaultProjectId }),
    meta: { silent: true },
  });
}

export function useImportTasks() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: ({ text, defaultProjectId }: TaskImportRequest) => backend().tasks.importJson(wid, text, { defaultProjectId }),
    onSuccess: () => {
      invalidateTaskData(client, wid);
      void client.invalidateQueries({ queryKey: keys.dependencies(wid) });
      void client.invalidateQueries({ queryKey: keys.tags(wid) });
    },
  });
}
