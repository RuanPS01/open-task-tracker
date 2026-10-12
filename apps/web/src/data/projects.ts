import type { CreateProjectInput, Id, Project, UpdateProjectInput } from '@ott/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '../app/session';
import { backend } from './backend';
import { keys } from './keys';

export function useProjects() {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.projects(wid),
    queryFn: () => backend().projects.list(wid),
    staleTime: 30_000,
  });
}

/** Mapa id para projeto, usado por toda tela que mostra o nome e a cor do projeto. */
export function useProjectMap(): Map<Id, Project> {
  const { data } = useProjects();
  const map = new Map<Id, Project>();
  for (const project of data ?? []) map.set(project.id, project);
  return map;
}

export function useCreateProject() {
  const client = useQueryClient();
  const wid = useWorkspaceId();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => backend().projects.create(wid, input),
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
    mutationFn: ({ id, ...input }: UpdateProjectInput & { id: Id }) => backend().projects.update(wid, id, input),
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
    mutationFn: (id: Id) => backend().projects.remove(wid, id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.projects(wid) });
      void client.invalidateQueries({ queryKey: keys.tasks(wid) });
      void client.invalidateQueries({ queryKey: keys.dependencies(wid) });
      void client.invalidateQueries({ queryKey: keys.timeEntries(wid) });
    },
  });
}
