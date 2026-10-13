import type { ChangePasswordInput, GoogleLoginInput, Id, LoginInput, SignupInput, UpdateProfileInput } from '@ott/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backend } from './backend';
import { keys } from './keys';

/** Sessão atual ou null quando ninguém entrou. */
export function useSessionQuery() {
  return useQuery({
    queryKey: keys.session,
    queryFn: () => backend().session.get(),
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => backend().session.login(input),
    onSuccess: (session) => client.setQueryData(keys.session, session),
    meta: { silent: true },
  });
}

/** Entrada pelo Google (só no modo Firebase). Idioma e fuso valem para a conta nova. */
export function useGoogleLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: GoogleLoginInput) => backend().session.loginWithGoogle(input),
    onSuccess: (session) => client.setQueryData(keys.session, session),
    meta: { silent: true },
  });
}

export function useSignup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SignupInput) => backend().session.signup(input),
    onSuccess: (session) => client.setQueryData(keys.session, session),
    meta: { silent: true },
  });
}

/** Modo local: entra com a conta de demonstração (cria na primeira vez). */
export function useStartDemo() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => backend().session.startDemo(),
    onSuccess: (session) => client.setQueryData(keys.session, session),
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => backend().session.logout(),
    onSuccess: () => {
      client.clear();
      client.setQueryData(keys.session, null);
    },
  });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => backend().session.updateProfile(input),
    onSuccess: (session) => client.setQueryData(keys.session, session),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => backend().session.changePassword(input),
  });
}

export function useSwitchWorkspace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: Id) => backend().session.switchWorkspace(workspaceId),
    onSuccess: (session) => {
      client.removeQueries({ queryKey: ['ws'] });
      client.setQueryData(keys.session, session);
    },
  });
}
