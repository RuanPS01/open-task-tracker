import { LOCAL_STORAGE_KEY } from '@ott/data';
import { MutationCache, QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { backend } from '../data/backend';
import { keys } from '../data/keys';
import { notifyError } from './notifier';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
  // Toda mutação que falha avisa o usuário, a menos que peça silêncio (meta.silent),
  // como o login, que mostra o erro dentro do próprio formulário.
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.silent) return;
      notifyError(error);
    },
  }),
});

/**
 * Mantém a tela em dia com mudanças feitas fora dela: login ou logout em outra aba
 * (ou sessão expirada no Firebase) e, no modo local, dados gravados por outra aba.
 */
function DataSync() {
  const client = useQueryClient();
  useEffect(() => {
    const data = backend();
    const stop = data.onAuthChange(() => void client.invalidateQueries({ queryKey: keys.session }));
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LOCAL_STORAGE_KEY) return;
      data.reload();
      void client.invalidateQueries();
    };
    if (data.mode === 'local') window.addEventListener('storage', onStorage);
    return () => {
      stop();
      window.removeEventListener('storage', onStorage);
    };
  }, [client]);
  return null;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DataSync />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
