import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useSessionQuery } from '../data/session';
import { ConfirmProvider } from '../components/ui/Confirm';
import { toast, Toaster } from '../components/ui/Toast';
import { guessLocale, I18nProvider } from '../i18n';
import { useErrorMessage } from '../lib/format';
import { setErrorNotifier } from './notifier';
import { applyTheme } from './theme';

function ErrorBridge() {
  const message = useErrorMessage();
  useEffect(() => setErrorNotifier((error) => toast.error(message(error))), [message]);
  return null;
}

/** Camada mais externa: idioma, tema, avisos e confirmações, com ou sem login. */
export function RootLayout() {
  const { data: session } = useSessionQuery();
  const preferences = session?.user.preferences;
  const locale = preferences?.locale ?? guessLocale();

  useEffect(() => {
    if (preferences) applyTheme(preferences.theme);
  }, [preferences]);

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
        <Outlet />
        <Toaster />
      </ConfirmProvider>
    </I18nProvider>
  );
}
