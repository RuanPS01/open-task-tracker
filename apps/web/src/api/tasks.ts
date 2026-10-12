import type {
  CreateDependencyInput,
  CreateTaskInput,
  ScheduleTasksInput,
  Task,
  TaskDependency,
  UpdateDependencyInput,
  UpdateTaskInput,
} from '@ott/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '../app/session';
import { request } from './client';
import { keys } from './keys';

// O workspace inteiro de tarefas fica num só cache: Lista, Quadro, Gantt e Linha do
// tempo leem a mesma fonte e nunca mostram versões diferentes da mesma tarefa.
export function useTasks() {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.tasks(wid),
    queryFn: () => request<Task[]>(`/workspaces/${wid}/tasks`),
    staleTime: 15_000,
  });
}

export function useDependencies() {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.dependencies(wid),
    queryFn: () => request<TaskDependency[]>(`/workspaces/${wid}/dependencies`),
    staleTime: 15_000,
  });
}

function invalidateTaskData(client: QueryClient, wid: number) {
  void client.invalidateQueries({ queryKey: keys.tasks(wid) });
  void client.invalidateQueries({ queryKey: keys.projects(wid) });
}

function patchTasks(client: QueryClient, wid: number, changes: Map<number, Partial<Task>>) {
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
    mutationFn: (input: CreateTaskInput) => request<Task>(`/workspaces/${wid}/tasks`, { method: 'POST', body: input }),
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
    mutationFn: ({ id, ...input }: UpdateTaskInput & { id: number }) =>
      request<Task>(`/workspaces/${wid}/tasks/${id}`, { method: 'PATCH', body: input }),
    onMutate: async ({ id, ...input }) => {
      await client.cancelQueries({ queryKey: keys.tasks(wid) });
      const previous = client.getQueryData<Task[]>(keys.tasks(wid));
      patchTasks(client, wid, new Map([[id, input as Partial<Task>]]));
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
    mutationFn: (input: ScheduleTasksInput) =>
      request<{ tasks: Task[] }>(`/workspaces/${wid}/tasks/schedule`, { method: 'POST', body: input }),
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

export function useDeleteTask() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (id: number) => request<void>(`/workspaces/${wid}/tasks/${id}`, { method: 'DELETE' }),
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
    mutationFn: (input: CreateDependencyInput) =>
      request<TaskDependency>(`/workspaces/${wid}/dependencies`, { method: 'POST', body: input }),
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
    mutationFn: ({ id, ...input }: UpdateDependencyInput & { id: number }) =>
      request<TaskDependency>(`/workspaces/${wid}/dependencies/${id}`, { method: 'PATCH', body: input }),
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
    mutationFn: (id: number) => request<void>(`/workspaces/${wid}/dependencies/${id}`, { method: 'DELETE' }),
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
