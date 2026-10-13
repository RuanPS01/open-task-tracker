import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useSessionQuery } from '../data/session';
import { ConfirmProvider } from '../components/ui/Confirm';
import { toast, Toaster } from '../components/ui/Toast';
import { guessLocale, I18nProvider } from '../i18n';
import { useErrorMessage } from '../lib/format';
import { useT } from '../i18n';
import { setErrorNotifier } from './notifier';
import { usePwa } from './pwa';
import { applyAccent, applyTheme } from './theme';

function ErrorBridge() {
  const message = useErrorMessage();
  useEffect(() => setErrorNotifier((error) => toast.error(message(error))), [message]);
  return null;
}

/** Avisa uma vez quando há versão nova do app baixada; "Atualizar" recarrega com ela. */
function PwaBridge() {
  const t = useT();
  const { applyUpdate } = usePwa();
  useEffect(() => {
    if (applyUpdate) toast.persistent(t.pwa.updateReady, { label: t.pwa.update, onClick: applyUpdate });
  }, [applyUpdate]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Camada mais externa: idioma, tema, avisos e confirmações, com ou sem login. */
export function RootLayout() {
  const { data: session } = useSessionQuery();
  const preferences = session?.user.preferences;
  const locale = preferences?.locale ?? guessLocale();

  // Paleta do workspace aberto (o mesmo que o AuthGate escolhe). Sem login, a padrão.
  const accent =
    session === undefined
      ? undefined
      : session === null
        ? null
        : ((session.workspaces.find((w) => w.id === session.user.currentWorkspaceId) ?? session.workspaces[0])?.color ?? null);

  useEffect(() => {
    if (preferences) applyTheme(preferences.theme);
  }, [preferences]);

  useEffect(() => {
    // Enquanto a sessão carrega, fica a cor que o index.html aplicou (sem piscar).
    if (accent !== undefined) applyAccent(accent);
  }, [accent]);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem('ott.locale', locale);
    } catch {
      // Sem armazenamento: idioma volta a ser detectado na próxima carga.
    }
  }, [locale]);

  return (
    <I18nProvider locale={locale}>
      <ConfirmProvider>
        <ErrorBridge />
        <PwaBridge />
        <Outlet />
        <Toaster />
      </ConfirmProvider>
    </I18nProvider>
  );
}
