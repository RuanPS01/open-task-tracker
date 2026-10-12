import type { CreateProjectInput, Project, UpdateProjectInput } from '@ott/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '../app/session';
import { request } from './client';
import { keys } from './keys';

export function useProjects() {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.projects(wid),
    queryFn: () => request<Project[]>(`/workspaces/${wid}/projects`),
    staleTime: 30_000,
  });
}

/** Mapa id para projeto, usado por toda tela que mostra o nome e a cor do projeto. */
export function useProjectMap(): Map<number, Project> {
  const { data } = useProjects();
  const map = new Map<number, Project>();
  for (const project of data ?? []) map.set(project.id, project);
  return map;
}

export function useCreateProject() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => request<Project>(`/workspaces/${wid}/projects`, { method: 'POST', body: input }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.projects(wid) });
      void client.invalidateQueries({ queryKey: keys.clients(wid) });
    },
  });
}

export function useUpdateProject() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateProjectInput & { id: number }) =>
      request<Project>(`/workspaces/${wid}/projects/${id}`, { method: 'PATCH', body: input }),
    onMutate: async ({ id, ...input }) => {
      await client.cancelQueries({ queryKey: keys.projects(wid) });
      const previous = client.getQueryData<Project[]>(keys.projects(wid));
      client.setQueryData<Project[]>(keys.projects(wid), (list) =>
        list?.map((project) => (project.id === id ? ({ ...project, ...input } as Project) : project)),
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) client.setQueryData(keys.projects(wid), context.previous);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.projects(wid) });
      void client.invalidateQueries({ queryKey: keys.clients(wid) });
    },
  });
}

export function useDeleteProject() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (id: number) => request<void>(`/workspaces/${wid}/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.projects(wid) });
      void client.invalidateQueries({ queryKey: keys.tasks(wid) });
      void client.invalidateQueries({ queryKey: keys.dependencies(wid) });
      void client.invalidateQueries({ queryKey: keys.timeEntries(wid) });
    },
  });
}
