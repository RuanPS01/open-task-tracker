import type {
  ChangePasswordInput,
  LoginInput,
  SessionResponse,
  SignupInput,
  UpdateProfileInput,
} from '@ott/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, request } from './client';
import { keys } from './keys';

/** Sessão atual ou null quando não há login (401 não é erro aqui). */
export function useSessionQuery() {
  return useQuery({
    queryKey: keys.session,
    queryFn: async () => {
      try {
        return await request<SessionResponse>('/auth/session');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => request<SessionResponse>('/auth/login', { method: 'POST', body: input }),
    onSuccess: (session) => client.setQueryData(keys.session, session),
    meta: { silent: true },
  });
}

export function useSignup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SignupInput) => request<SessionResponse>('/auth/signup', { method: 'POST', body: input }),
    onSuccess: (session) => client.setQueryData(keys.session, session),
    meta: { silent: true },
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => request<{ ok: true }>('/auth/logout', { method: 'POST', body: {} }),
    onSuccess: () => {
      client.clear();
      client.setQueryData(keys.session, null);
    },
  });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => request<SessionResponse>('/me', { method: 'PATCH', body: input }),
    onSuccess: (session) => client.setQueryData(keys.session, session),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => request<{ ok: true }>('/me/password', { method: 'POST', body: input }),
  });
}

export function useSwitchWorkspace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: number) =>
      request<SessionResponse>('/me/workspace', { method: 'POST', body: { workspaceId } }),
    onSuccess: (session) => {
      client.removeQueries({ queryKey: ['ws'] });
      client.setQueryData(keys.session, session);
    },
  });
}
